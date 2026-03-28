// ============================================================
// GeoLearn Japan — paypal-webhook Edge Function
//
// Receives PayPal PAYMENT.CAPTURE.COMPLETED webhooks,
// verifies the signature, generates a 30-day license key,
// saves it to Supabase, and emails it to the buyer via Resend.
//
// Required Supabase secrets:
//   PAYPAL_CLIENT_ID      — from PayPal Developer dashboard
//   PAYPAL_CLIENT_SECRET  — from PayPal Developer dashboard
//   PAYPAL_WEBHOOK_ID     — the Webhook ID created in PayPal Developer
//   RESEND_API_KEY        — from resend.com
//
// Optional:
//   PAYPAL_BASE_URL       — defaults to https://api-m.paypal.com
//                           use https://api-m.sandbox.paypal.com for testing
//
// Deploy:
//   supabase functions deploy paypal-webhook --no-verify-jwt
//
// Register webhook URL in PayPal Developer:
//   https://ftmkgkxzgobgjkasnmxn.supabase.co/functions/v1/paypal-webhook
//   Event: PAYMENT.CAPTURE.COMPLETED
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders }  from '../_shared/cors.ts'
import { sendLicenseKeyEmail } from '../_shared/email.ts'

const CHARS           = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const EXPECTED_AMOUNT = '5.00'   // USD — must match your Gumroad / PayPal.me price

function randomSeg(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

// ── Get PayPal OAuth token ────────────────────────────────────
async function getPayPalToken(): Promise<string> {
  const base   = Deno.env.get('PAYPAL_BASE_URL') ?? 'https://api-m.paypal.com'
  const id     = Deno.env.get('PAYPAL_CLIENT_ID')     ?? ''
  const secret = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? ''

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(id + ':' + secret)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const { access_token } = await res.json()
  return access_token
}

// ── Verify webhook signature via PayPal API ───────────────────
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
  if (!webhookId) {
    console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID not set — skipping verification')
    return true   // allow through in dev; set the secret in production
  }

  try {
    const token = await getPayPalToken()
    const base  = Deno.env.get('PAYPAL_BASE_URL') ?? 'https://api-m.paypal.com'

    const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo:         req.headers.get('PAYPAL-AUTH-ALGO'),
        cert_url:          req.headers.get('PAYPAL-CERT-URL'),
        transmission_id:   req.headers.get('PAYPAL-TRANSMISSION-ID'),
        transmission_sig:  req.headers.get('PAYPAL-TRANSMISSION-SIG'),
        transmission_time: req.headers.get('PAYPAL-TRANSMISSION-TIME'),
        webhook_id:        webhookId,
        webhook_event:     JSON.parse(rawBody),
      }),
    })
    const { verification_status } = await res.json()
    return verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal-webhook] Signature verification error:', err)
    return false
  }
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  try {
    const rawBody = await req.text()

    const verified = await verifySignature(req, rawBody)
    if (!verified) return json({ error: 'Invalid webhook signature' }, 401)

    const event = JSON.parse(rawBody)

    // Only process completed payment captures
    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return json({ success: true, skipped: event.event_type })
    }

    const resource   = event.resource ?? {}
    const amount     = resource?.amount?.value
    const buyerEmail = resource?.payer?.email_address
                    ?? resource?.payee?.email_address
    const txnRef     = resource?.id ?? event.id

    if (!buyerEmail)       return json({ error: 'No buyer email in webhook' }, 400)
    if (amount !== EXPECTED_AMOUNT) {
      console.warn(`[paypal-webhook] Unexpected amount: ${amount}`)
      return json({ error: `Unexpected amount: ${amount}` }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Idempotency — skip if already processed
    const { data: existing } = await supabase
      .from('payment_requests')
      .select('id, license_key')
      .eq('txn_ref', txnRef)
      .maybeSingle()

    if (existing) {
      return json({ success: true, message: 'Already processed', key: existing.license_key })
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
      note:         `PayPal auto — ${buyerEmail}`,
    })

    await supabase.from('payment_requests').insert({
      method:       'paypal',
      buyer_email:  buyerEmail,
      txn_ref:      txnRef,
      amount:       `$${amount} USD`,
      status:       'approved',
      license_key:  key,
      processed_at: new Date().toISOString(),
    })

    const emailSent = await sendLicenseKeyEmail(buyerEmail, key)
    console.log(`[paypal-webhook] Key sent to ${buyerEmail}: ${key} (email: ${emailSent})`)

    return json({ success: true, email_sent: emailSent })

  } catch (err) {
    console.error('[paypal-webhook] Unhandled error:', err)
    return json({ error: 'Server error' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
