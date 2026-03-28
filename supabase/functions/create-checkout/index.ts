// ============================================================
// GeoLearn Japan — create-checkout Edge Function
//
// Creates a Stripe Checkout Session for card / Apple Pay /
// Google Pay / PayNow payments.
//
// Required secrets:
//   STRIPE_SECRET_KEY — Stripe Dashboard → Developers → API Keys
//
// Deploy:
//   supabase functions deploy create-checkout --no-verify-jwt
// ============================================================

import Stripe from 'https://esm.sh/stripe@14.21.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500)

  let body: { success_url?: string; cancel_url?: string; email?: string }
  try { body = await req.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  try {
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'paynow'],
      line_items: [{
        price_data: {
          currency: 'sgd',
          product_data: {
            name: 'GeoLearn Premium',
            description: '1 month · 2 devices · Full platform unlock',
          },
          unit_amount: 700, // SGD 7.00 in cents
        },
        quantity: 1,
      }],
      customer_email: body.email || undefined,
      success_url: body.success_url ?? 'https://golem7x.github.io/GeoLearn-Japan/?payment=success',
      cancel_url:  body.cancel_url  ?? 'https://golem7x.github.io/GeoLearn-Japan/?payment=cancelled',
      metadata: { product: 'geolearn_premium' },
    })

    return json({ url: session.url })

  } catch (err) {
    console.error('[create-checkout] Stripe error:', err)
    return json({ error: 'Failed to create checkout session' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
