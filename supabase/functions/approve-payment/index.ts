// ============================================================
// GeoLearn Japan — approve-payment Edge Function
//
// Admin tool for KBZPay payments. Lists pending requests and
// approves them (generates key + sends email automatically).
//
// Authentication: X-Admin-Secret header = GENERATE_SECRET env var
//
// Actions (POST body):
//   { action: 'list' }
//     → returns all pending payment requests
//
//   { action: 'approve', payment_request_id: '<uuid>' }
//     → generates license key, emails buyer, marks approved
//
//   { action: 'reject', payment_request_id: '<uuid>' }
//     → marks request as rejected
//
// Deploy:
//   supabase functions deploy approve-payment --no-verify-jwt
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders }  from '../_shared/cors.ts'
import { sendLicenseKeyEmail } from '../_shared/email.ts'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSeg(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  // ── Auth ──────────────────────────────────────────────────
  const secret   = req.headers.get('X-Admin-Secret') ?? ''
  const expected = Deno.env.get('GENERATE_SECRET')   ?? ''
  if (!expected || secret !== expected) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const action = body.action as string

  // ── LIST pending payments ─────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, method, buyer_email, amount, txn_ref, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) return json({ error: error.message }, 500)
    return json({ success: true, requests: data ?? [] })
  }

  // ── APPROVE ───────────────────────────────────────────────
  if (action === 'approve') {
    const id = body.payment_request_id as string
    if (!id) return json({ error: 'payment_request_id required' }, 400)

    const { data: request, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single()

    if (error || !request) {
      return json({ error: 'Payment request not found or already processed' }, 404)
    }

    // Generate license key (30 days, 2 devices)
    const year      = new Date().getFullYear()
    const key       = `GEOLEARN-${year}-${randomSeg(4)}-${randomSeg(4)}`
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('license_keys').insert({
      key,
      max_devices:  2,
      used_devices: 0,
      is_active:    true,
      expires_at:   expiresAt,
      note:         `KBZPay approved — ${request.buyer_email}`,
    })

    await supabase.from('payment_requests').update({
      status:       'approved',
      license_key:  key,
      processed_at: new Date().toISOString(),
    }).eq('id', id)

    const emailSent = await sendLicenseKeyEmail(request.buyer_email, key)
    console.log(`[approve-payment] Approved ${id}: key=${key}, email=${emailSent}`)

    return json({ success: true, key, email_sent: emailSent })
  }

  // ── REJECT ────────────────────────────────────────────────
  if (action === 'reject') {
    const id = body.payment_request_id as string
    if (!id) return json({ error: 'payment_request_id required' }, 400)

    const { error } = await supabase
      .from('payment_requests')
      .update({ status: 'rejected', processed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')

    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  return json({ error: 'Unknown action. Use: list | approve | reject' }, 400)
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
