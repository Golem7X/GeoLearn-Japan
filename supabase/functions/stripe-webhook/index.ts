// ============================================================
// GeoLearn Japan — stripe-webhook Edge Function
//
// Handles Stripe checkout.session.completed events.
// Generates a 30-day license key and emails it to the buyer.
//
// Required secrets:
//   STRIPE_SECRET_KEY     — Stripe Dashboard → Developers → API Keys
//   STRIPE_WEBHOOK_SECRET — Stripe Dashboard → Webhooks → signing secret
//   RESEND_API_KEY        — resend.com
//
// Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Register webhook in Stripe Dashboard → Developers → Webhooks:
//   URL:   https://ftmkgkxzgobgjkasnmxn.supabase.co/functions/v1/stripe-webhook
//   Event: checkout.session.completed
// ============================================================

import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendLicenseKeyEmail } from '../_shared/email.ts'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSeg(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const stripeKey     = Deno.env.get('STRIPE_SECRET_KEY')     ?? ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500)

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const rawBody = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = webhookSecret
      ? await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret)
      : JSON.parse(rawBody) // skip verification in dev if secret not set
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return json({ error: 'Invalid signature' }, 400)
  }

  // Only process completed checkouts
  if (event.type !== 'checkout.session.completed') {
    return json({ success: true, skipped: event.type })
  }

  const session    = event.data.object as Stripe.Checkout.Session
  const buyerEmail = session.customer_email ?? session.customer_details?.email ?? null
  const txnRef     = (session.payment_intent as string) ?? session.id

  if (!buyerEmail) return json({ error: 'No buyer email in session' }, 400)

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
    note:         `Stripe auto — ${buyerEmail}`,
  })

  await supabase.from('payment_requests').insert({
    method:       'stripe',
    buyer_email:  buyerEmail,
    txn_ref:      txnRef,
    amount:       'SGD 7',
    status:       'approved',
    license_key:  key,
    processed_at: new Date().toISOString(),
  })

  const emailSent = await sendLicenseKeyEmail(buyerEmail, key)
  console.log(`[stripe-webhook] Key sent to ${buyerEmail}: ${key} (email: ${emailSent})`)

  return json({ success: true, email_sent: emailSent })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
