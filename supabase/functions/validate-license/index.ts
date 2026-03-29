// ============================================================
// GeoLearn Japan — validate-license Edge Function
// Deno / Supabase Edge Functions runtime
//
// Responsibilities:
//   1. Verify caller (authenticated user OR anonymous with apikey)
//   2. Rate-limit validation attempts (max 5 per minute per user)
//   3. Look up the license key in license_keys table
//   4. Validate: exists · is_active · not expired
//   5. Check device limit (max_devices)
//   6. Insert / update license_activations record
//   7. Upsert subscriptions row → plan = 'premium'
//   8. Return { success, plan } or { success: false, error }
//
// Supports two modes:
//   • Authenticated: Full device tracking + subscription management
//   • Anonymous: Key validation + basic device tracking (no subscription)
//
// Deploy:
//   supabase functions deploy validate-license --no-verify-jwt
//   (JWT is verified manually inside the function)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // ── Preflight ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    // ── Supabase admin client (service role — bypasses RLS) ──
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // ── Determine auth mode ─────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    let user: { id: string } | null = null
    let isAnonymous = false

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Try to resolve a real user from JWT
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user: authUser }, error: userError } = await supabaseUser.auth.getUser()
      if (authUser) {
        user = authUser
      }
    }

    if (!user) {
      // Anonymous mode — allow basic key validation without JWT
      isAnonymous = true
    }

    // ── Parse body ───────────────────────────────────────────
    let body: Record<string, string>
    try {
      body = await req.json()
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    const { license_key, device_fingerprint, mode } = body
    if (!license_key || typeof license_key !== 'string' || license_key.trim() === '') {
      return json({ success: false, error: 'License key is required' }, 400)
    }

    const normalizedKey = license_key.trim().toUpperCase()
    const fingerprint   = (device_fingerprint || 'unknown').slice(0, 64)
    const checkOnly     = mode === 'check' // Validate without activating

    // ── Rate limiting (authenticated users only) ────────────
    if (user && !isAnonymous) {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
      const { count: recentCount } = await supabaseAdmin
        .from('license_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneMinuteAgo)

      if ((recentCount ?? 0) >= 5) {
        return json({
          success: false,
          error: 'Too many attempts. Please wait 1 minute before trying again. / しばらくお待ちください。'
        }, 429)
      }

      // Log this attempt (key_prefix only — never store full key)
      await supabaseAdmin.from('license_attempts').insert({
        user_id:    user.id,
        key_prefix: normalizedKey.substring(0, 4),
        created_at: new Date().toISOString()
      })
    }

    // ── Look up license key ──────────────────────────────────
    const { data: license, error: licError } = await supabaseAdmin
      .from('license_keys')
      .select('id, is_active, expires_at, max_devices, used_devices')
      .eq('key', normalizedKey)
      .single()

    if (licError || !license) {
      return json({ success: false, error: 'Invalid license key. Please check and try again.' })
    }

    // ── Validate: active ─────────────────────────────────────
    if (!license.is_active) {
      return json({ success: false, error: 'This license key has been deactivated.' })
    }

    // ── Validate: not expired ────────────────────────────────
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return json({ success: false, error: 'This license key has expired.' })
    }

    // ── Check-only mode: return validity without activating ──
    if (checkOnly) {
      return json({
        success: true,
        plan: 'premium',
        mode: 'check',
        expires_at: license.expires_at,
        devices: `${license.used_devices}/${license.max_devices}`
      })
    }

    // ── Device limit check ───────────────────────────────────
    if (license.used_devices >= license.max_devices) {
      return json({
        success: false,
        error: `Device limit reached (max ${license.max_devices} devices). ` +
               'Please contact support to add more devices.'
      })
    }

    // ── Activation record (authenticated users) ──────────────
    if (user && !isAnonymous) {
      const { data: existingActivation } = await supabaseAdmin
        .from('license_activations')
        .select('id, device_fingerprint')
        .eq('license_id', license.id)
        .eq('user_id', user.id)
        .single()

      if (existingActivation) {
        // Same user re-activating — just refresh device fingerprint
        if (existingActivation.device_fingerprint !== fingerprint) {
          await supabaseAdmin
            .from('license_activations')
            .update({ device_fingerprint: fingerprint })
            .eq('id', existingActivation.id)
        }
      } else {
        // Insert activation record
        const { error: insertError } = await supabaseAdmin
          .from('license_activations')
          .insert({
            license_id:         license.id,
            user_id:            user.id,
            device_fingerprint: fingerprint,
            activated_at:       new Date().toISOString()
          })

        if (insertError) {
          console.error('Activation insert error:', insertError)
          return json({ success: false, error: 'Activation failed. Please try again.' }, 500)
        }

        // Increment used_devices counter
        await supabaseAdmin
          .from('license_keys')
          .update({ used_devices: license.used_devices + 1 })
          .eq('id', license.id)
      }

      // ── Upsert subscription → premium ───────────────────────
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id:      user.id,
          plan:         'premium',
          license_key:  normalizedKey,
          activated_at: new Date().toISOString(),
          updated_at:   new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (subError) {
        console.error('Subscription upsert error:', subError)
        return json({ success: false, error: 'Failed to activate subscription.' }, 500)
      }
    } else {
      // ── Anonymous activation: just increment device count ───
      await supabaseAdmin
        .from('license_keys')
        .update({ used_devices: license.used_devices + 1 })
        .eq('id', license.id)
    }

    // ── Success ──────────────────────────────────────────────
    return json({ success: true, plan: 'premium' })

  } catch (err) {
    console.error('validate-license unhandled error:', err)
    return json({ success: false, error: 'Server error. Please try again.' }, 500)
  }
})

// ── Utility ──────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
