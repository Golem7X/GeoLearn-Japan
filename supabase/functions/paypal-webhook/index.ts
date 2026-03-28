// ============================================================
// GeoLearn Japan — paypal-webhook (DEPRECATED)
//
// PayPal payments have been removed. This endpoint now returns
// 410 Gone to notify any lingering webhooks that the integration
// is no longer active.
//
// Payment is now handled via Singapore bank transfers:
//   PayNow · DBS Bank · UOB Bank
// ============================================================

import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  return new Response(
    JSON.stringify({ error: 'PayPal payments are no longer accepted. Please use PayNow, DBS Bank, or UOB Bank.' }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
