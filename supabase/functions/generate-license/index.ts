// ============================================================
// GeoLearn Japan — generate-license Edge Function
//
// Generates license keys and inserts them into license_keys table.
// Authentication: X-Admin-Secret header must match GENERATE_SECRET env var.
//
// Body (JSON):
//   quantity    number  1–50  (default 5)
//   max_devices number  1–10  (default 2)
//   expires_at  string  ISO date or null
//   note        string  optional batch label
//   prefix      string  optional key prefix (default GEOLEARN)
//
// Deploy:
//   supabase functions deploy generate-license --no-verify-jwt
//   supabase secrets set GENERATE_SECRET=your-secret-here
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion

function randomSegment(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json('ok', 200, true)
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  // ── Verify admin secret ──────────────────────────────────────
  const secret         = req.headers.get('X-Admin-Secret') ?? ''
  const expectedSecret = Deno.env.get('GENERATE_SECRET')   ?? ''

  if (!expectedSecret) {
    return json({ success: false, error: 'GENERATE_SECRET env var not set.' }, 500)
  }
  if (secret !== expectedSecret) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  // ── Parse body ───────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const quantity    = Math.min(Math.max(Number(body.quantity)    || 5,  1), 50)
  const max_devices = Math.min(Math.max(Number(body.max_devices) || 2,  1), 10)
  const expires_at  = (body.expires_at as string) || null
  const note        = ((body.note as string) || '').slice(0, 100) || null
  const prefix      = ((body.prefix as string) || 'GEOLEARN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12) || 'GEOLEARN'

  const year = new Date().getFullYear()

  // ── Generate unique keys ─────────────────────────────────────
  const keys: string[] = []
  while (keys.length < quantity) {
    const key = `${prefix}-${year}-${randomSegment(4)}-${randomSegment(4)}`
    if (!keys.includes(key)) keys.push(key)
  }

  // ── Insert into Supabase ─────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const rows = keys.map(key => ({
    key,
    max_devices,
    used_devices: 0,
    is_active:    true,
    expires_at:   expires_at || null,
    note:         note       || null,
    created_at:   new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('license_keys')
    .insert(rows)
    .select('key, max_devices, expires_at, note, created_at')

  if (error) {
    console.error('Insert error:', error)
    return json({ success: false, error: 'Failed to insert keys: ' + error.message }, 500)
  }

  return json({ success: true, keys: data ?? rows })
})

// ── Utility ───────────────────────────────────────────────────
function json(body: unknown, status = 200, plain = false): Response {
  if (plain) return new Response(body as string, { status, headers: corsHeaders })
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
