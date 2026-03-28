// ============================================================
// GeoLearn Japan — Shared Email Helper
// Sends license key emails via Resend (https://resend.com)
//
// Required env var:
//   RESEND_API_KEY   — get from resend.com (free: 3,000 emails/month)
//
// Optional env var:
//   RESEND_FROM_EMAIL — defaults to 'GeoLearn Japan <onboarding@resend.dev>'
//                       For production, verify your domain at resend.com and
//                       use e.g. 'GeoLearn Japan <noreply@yourdomain.com>'
// ============================================================

export async function sendLicenseKeyEmail(to: string, key: string): Promise<boolean> {
  const apiKey   = Deno.env.get('RESEND_API_KEY') ?? ''
  const fromAddr = Deno.env.get('RESEND_FROM_EMAIL') ?? 'GeoLearn Japan <onboarding@resend.dev>'

  if (!apiKey) {
    console.error('[email] RESEND_API_KEY is not set')
    return false
  }

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#0a0c10;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#0d0f14;border:1px solid rgba(255,215,0,.22);border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1a2040,#0d0f14);padding:28px 32px;border-bottom:1px solid rgba(255,215,0,.15)">
      <div style="font-size:20px;font-weight:800;color:#FFD700">&#9968; GeoLearn Japan</div>
      <div style="font-size:11px;color:#666;margin-top:3px">Geotechnical Engineering Study Platform</div>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;font-weight:700;color:#fff;margin:0 0 8px">Your Premium License Key is Ready!</p>
      <p style="font-size:13px;color:#aaa;margin:0 0 24px;line-height:1.6">Thank you for your purchase. Your 30-day premium access key is below.</p>
      <div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.3);border-radius:10px;padding:22px;text-align:center;margin-bottom:24px">
        <div style="font-size:10px;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">LICENSE KEY</div>
        <div style="font-family:monospace;font-size:20px;font-weight:700;color:#FFD700;letter-spacing:2px;word-break:break-all">${key}</div>
      </div>
      <p style="font-size:12px;font-weight:600;color:#ccc;margin:0 0 10px">How to activate:</p>
      <ol style="font-size:13px;color:#aaa;line-height:2.2;padding-left:18px;margin:0 0 20px">
        <li>Open GeoLearn Japan</li>
        <li>Go to <strong style="color:#fff">Activate Premium</strong></li>
        <li>Paste your key and click <strong style="color:#fff">Activate</strong></li>
      </ol>
      <div style="background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:12px 16px;font-size:11px;color:#666;line-height:1.9">
        &#9200; Valid for <strong style="color:#aaa">30 days</strong> &nbsp;&middot;&nbsp;
        &#128241; Up to <strong style="color:#aaa">2 devices</strong><br>
        After 30 days, purchase a new key to renew your access.
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.05);font-size:11px;color:#444;text-align:center">
      Questions? Contact myonaingtun404@gmail.com
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    fromAddr,
        to:      [to],
        subject: 'Your GeoLearn Japan Premium License Key',
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend error:', err)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] Network error:', err)
    return false
  }
}
