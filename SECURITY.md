# Security Policy — GeoLearn Japan

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅ Active security support |
| All others | ❌ |

---

## Security Architecture

GeoLearn Japan follows a **Defense-in-Depth** security model based on:

- **NIST Cybersecurity Framework** (Identify → Protect → Detect → Respond → Recover)
- **OWASP Top 10** — mitigations for all applicable vulnerabilities
- **CIS Controls** — applicable controls for a static web application
- **Zero Trust Principles** — deny by default, verify always

### Layer 1 — Transport Security
- HTTPS enforced via Cloudflare (HSTS `max-age=63072000; includeSubDomains; preload`)
- `upgrade-insecure-requests` + `block-all-mixed-content` in CSP
- HSTS preload list submission recommended

### Layer 2 — Content Security Policy
- **Hash-based CSP** (`'strict-dynamic'` + SHA-256 script hashes)
- No `'unsafe-inline'`, no `'unsafe-eval'` for scripts
- `default-src 'none'` — deny-by-default for all resource types
- `frame-ancestors 'none'` — prevents all iframe embedding (clickjacking)
- `form-action 'none'` — no form submissions
- `connect-src 'none'` — no unauthorized network requests

### Layer 3 — XSS Prevention
- **DOMPurify 3.1.6** embedded inline (no CDN dependency)
- **Trusted Types API** — enforces DOMPurify on all `innerHTML` / DOM sink assignments
- All user input is sanitized before DOM insertion
- Zero inline `onclick` handlers — replaced by delegated event listeners
- `escHtml()` uses DOMPurify with empty allowlist for plain-text contexts

### Layer 4 — Runtime Hardening
- Prototype pollution prevention via `Object.assign` guard
- CSP violation event monitoring
- Global security state frozen (`Object.freeze`)
- `Permissions-Policy` blocks all unnecessary browser APIs

### Layer 5 — Infrastructure (Cloudflare)
- Cloudflare WAF with OWASP Core Ruleset
- DDoS protection (Enterprise-grade at Cloudflare free tier)
- Bot detection and challenge
- CDN with geographic access control (configurable)
- Full HTTP security headers via `_headers` file

### Layer 6 — Repository Security
- CodeQL static analysis on every push
- Dependabot vulnerability alerts for all dependencies
- Secret scanning (prevents API key commits)
- Branch protection on `main` (require PR + review)
- Signed commits encouraged

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities in GitHub Issues.**

### Responsible Disclosure

Report vulnerabilities via one of:
- **GitHub Private Vulnerability Reporting** (preferred):
  `Security` tab → `Report a vulnerability`
- **Email**: [contact the repository owner via GitHub profile]

### What to Include
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested remediation (optional)

### Response Timeline
| Stage | Timeline |
|-------|----------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 30 days for critical, 90 days for others |
| Public disclosure | Coordinated with reporter |

---

## Known Security Limitations

### GitHub Pages Specific
GitHub Pages does not support custom HTTP response headers. Security headers
listed in `_headers` are only enforced when deployed to Cloudflare Pages or
Netlify. When running from `github.io`, headers are implemented via meta tags
(with the following limitations):

| Header | Meta Tag | HTTP Header | Notes |
|--------|----------|-------------|-------|
| CSP | ✅ (partial) | ✅ (full, via Cloudflare) | Meta CSP cannot set `frame-ancestors` |
| X-Frame-Options | ⚠️ (limited support) | ✅ | HTTP header recommended |
| HSTS | ❌ | ✅ | Only works as HTTP header |
| X-Content-Type-Options | ⚠️ | ✅ | |
| Permissions-Policy | ❌ | ✅ | Only works as HTTP header |
| COEP | ❌ | ✅ | Omitted due to Google Fonts incompatibility |

### Client-Side Code Visibility
As a static web application, all JavaScript is visible in browser DevTools.
The application contains no server-side secrets. Source code protection is
implemented via:
- Code hardening (Trusted Types, CSP, DOMPurify)
- DevTools detection (deterrence, not prevention)
- Intellectual property protection via copyright law

**Recommendation**: Keep the GitHub repository private and deploy via CI/CD
to Cloudflare Pages for maximum protection.

---

## Security Checklist (for maintainers)

### Before every release
- [ ] Run `node scripts/security-check.js` — all checks must pass
- [ ] Verify CSP hashes are current (auto-updated by build process)
- [ ] Review any new `innerHTML` assignments — must use `escHtml()` or DOMPurify
- [ ] Check for new external resources added — must be whitelisted in CSP
- [ ] Run `npm audit` — no critical/high vulnerabilities

### Monthly
- [ ] Review GitHub Dependabot alerts
- [ ] Review CodeQL findings
- [ ] Check Cloudflare security analytics for anomalies
- [ ] Rotate any access tokens or deploy keys

### Quarterly
- [ ] Review and update CSP directives
- [ ] Test OWASP ZAP scan against staging
- [ ] Review and update this security policy
