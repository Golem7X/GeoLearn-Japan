// Self-contained version for Supabase Dashboard deployment (no relative imports)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSegment(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  const secret         = req.headers.get('X-Admin-Secret') ?? ''
  const expectedSecret = Deno.env.get('GENERATE_SECRET')   ?? ''

  if (!expectedSecret) {
    return json({ success: false, error: 'GENERATE_SECRET env var not set.' }, 500)
  }
  if (secret !== expectedSecret) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return json({ success: false, error: 'Invalid JSON body' }, 400) }

  const quantity    = Math.min(Math.max(Number(body.quantity)    || 5,  1), 50)
  const max_devices = Math.min(Math.max(Number(body.max_devices) || 2,  1), 10)
  const note        = ((body.note as string) || '').slice(0, 100) || null
  const thirtyDays  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const expires_at  = (body.expires_at as string) || thirtyDays
  const prefix      = ((body.prefix as string) || 'GEOLEARN')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'GEOLEARN'

  const year = new Date().getFullYear()
  const keys: string[] = []
  while (keys.length < quantity) {
    const key = `${prefix}-${year}-${randomSegment(4)}-${randomSegment(4)}`
    if (!keys.includes(key)) keys.push(key)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const rows = keys.map(key => ({
    key, max_devices, used_devices: 0, is_active: true,
    expires_at: expires_at || null, note: note || null,
    created_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('license_keys').insert(rows)
    .select('key, max_devices, expires_at, note, created_at')

  if (error) {
    console.error('Insert error:', error)
    return json({ success: false, error: 'Failed to insert keys: ' + error.message }, 500)
  }

  return json({ success: true, keys: data ?? rows })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
