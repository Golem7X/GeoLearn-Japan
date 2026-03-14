# MYO_Geo_Orgs — Ownership & IP Framework

> **Official intellectual property documentation for all software developed
> under the MYO_Geo_Orgs organization.**

---

## Organization Description

**MYO_Geo_Orgs** is an independent software development organization founded
and operated by **MYO NAING TUN**. The organization specializes in the design
and development of educational technology applications, with a focus on
geotechnical and geophysical engineering learning tools, professional study
platforms, and interactive web-based software.

MYO_Geo_Orgs represents the personal technology brand of MYO NAING TUN and
serves as the unified identity for all software, applications, tools, and
digital products created under this brand — now and in the future.

**Core Mission:** Build high-quality, accessible, and technically rigorous
educational software for engineers, geoscientists, and students worldwide.

---

## Founder Statement

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FOUNDER & SOLE CREATOR

  Name         : MYO NAING TUN
  Organization : MYO_Geo_Orgs
  Role         : Founder · Developer · Designer · Author
  GitHub       : https://github.com/Golem7X
  First Project: GeoLearn-Japan (2024)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

MYO NAING TUN is the **sole founder, creator, and owner** of MYO_Geo_Orgs and
all software produced under this organization. All intellectual property rights,
including copyright, design rights, and any other applicable IP rights, vest
exclusively in MYO NAING TUN unless explicitly and formally transferred in
writing.

---

## Software Ownership Declaration

All software, applications, tools, and digital works developed and published
under the **MYO_Geo_Orgs** brand are the exclusive intellectual property of
**MYO NAING TUN**. This declaration applies to all past, current, and future
projects released under this organization.

### Protected Assets

| Category | What is Protected |
|---|---|
| **Source Code** | All HTML, CSS, JavaScript, and any other code in any language |
| **Architecture** | System design, data structures, algorithms, and logic patterns |
| **UI/UX Design** | Layouts, color schemes, component designs, interaction flows |
| **Animations** | All motion design, canvas animations, CSS transitions |
| **Graphics** | Icons, illustrations, visual assets, and imagery |
| **Educational Content** | Lessons, flashcards, quizzes, explanations, formulas |
| **Documentation** | READMEs, guides, tutorials, SECURITY.md, OWNERSHIP.md |
| **Branding** | Name "MYO_Geo_Orgs", "GeoLearn Japan", logos, trademarks |
| **Build Systems** | Build scripts, CI/CD pipelines, security tooling |

---

## Standard Copyright Notice

Use this exact notice in **every** future MYO_Geo_Orgs project:

### For HTML files (in `<head>`):
```html
<!--
  ╔══════════════════════════════════════════════════════════════╗
  ║  Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs      ║
  ║  All Rights Reserved.                                        ║
  ║  Licensed under MYO_Geo_Orgs Proprietary License v1.0       ║
  ║  Unauthorized copying or redistribution is prohibited.       ║
  ║  https://github.com/Golem7X                                  ║
  ╚══════════════════════════════════════════════════════════════╝
-->
```

### For JavaScript files:
```js
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  [Project Name] — MYO_Geo_Orgs                              ║
 * ║  Copyright (c) 2026 MYO NAING TUN                      ║
 * ║  All Rights Reserved.                                        ║
 * ║                                                              ║
 * ║  PROPRIETARY AND CONFIDENTIAL                                ║
 * ║  Unauthorized copying, modification, or distribution        ║
 * ║  of this software is strictly prohibited.                    ║
 * ║                                                              ║
 * ║  License : MYO_Geo_Orgs Proprietary Software License v1.0   ║
 * ║  Author  : MYO NAING TUN                                     ║
 * ║  GitHub  : https://github.com/Golem7X                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
```

### For README.md files:
```markdown
---
> **Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs — All Rights Reserved.**
> Licensed under the [MYO_Geo_Orgs Proprietary License v1.0](./LICENSE).
> Unauthorized copying or redistribution is strictly prohibited.
---
```

### For Python / other scripts:
```python
# ══════════════════════════════════════════════════════════════
# Copyright (c) 2026 MYO NAING TUN / MYO_Geo_Orgs
# All Rights Reserved.
# MYO_Geo_Orgs Proprietary Software License v1.0
# Unauthorized copying or redistribution is prohibited.
# ══════════════════════════════════════════════════════════════
```

---

## GitHub Integration Instructions

### Step 1 — Repository Setup (Every New Project)

```
your-repo/
├── LICENSE              ← MYO_Geo_Orgs Proprietary License v1.0
├── OWNERSHIP.md         ← This document
├── SECURITY.md          ← Security policy
├── README.md            ← With copyright notice at top and bottom
├── .github/
│   ├── CODEOWNERS       ← @Golem7X owns all files
│   ├── dependabot.yml   ← Dependency security
│   └── workflows/
│       └── security.yml ← Security CI pipeline
```

### Step 2 — Repository Settings (GitHub UI)

1. **About section**: Add `© MYO NAING TUN / MYO_Geo_Orgs — Proprietary` to description
2. **Topics**: Add tags: `proprietary`, `myo-geo-orgs`, `myo-naing-tun`
3. **Social Preview**: Add branded image with copyright notice
4. **Branch Protection** on `main`:
   - Require pull request reviews: ✅
   - Require status checks to pass: ✅ (security.yml)
   - Restrict who can push to matching branches: only `@Golem7X`
   - Do not allow force pushes: ✅
   - Do not allow deletions: ✅

### Step 3 — Enable GitHub Security Features

Navigate to: **Settings → Security → Code security and analysis**

| Feature | Action |
|---|---|
| Dependabot alerts | ✅ Enable |
| Dependabot security updates | ✅ Enable |
| Secret scanning | ✅ Enable |
| Push protection | ✅ Enable (blocks commits with secrets) |
| Code scanning (CodeQL) | ✅ Enable (auto-setup) |
| Private vulnerability reporting | ✅ Enable |

### Step 4 — README Copyright Footer

Add this to the **bottom of every README.md**:

```markdown
---

## License & Ownership

Copyright (c) 2026 **MYO NAING TUN** / **MYO_Geo_Orgs**

All rights reserved. This software is **proprietary and confidential**.

Unauthorized copying, modification, redistribution, or commercial use
of this software, in whole or in part, is **strictly prohibited** without
prior written permission from the author.

Licensed under the [MYO_Geo_Orgs Proprietary Software License v1.0](./LICENSE).

**Developer:** MYO NAING TUN | **Organization:** MYO_Geo_Orgs | [GitHub](https://github.com/Golem7X)
```

### Step 5 — Commit Signing (Proves Authorship in Git History)

```bash
# Generate a GPG key
gpg --full-generate-key
# Select: RSA, 4096 bits, no expiration

# Get your key ID
gpg --list-secret-keys --keyid-format LONG

# Tell Git to use it
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Add public key to GitHub
# Settings → SSH and GPG keys → New GPG key
gpg --armor --export YOUR_KEY_ID
```

Every signed commit carries a cryptographic proof that **MYO NAING TUN**
authored the code — creating an immutable, verifiable record of authorship.

---

## IP Protection Checklist

### Every New Project
- [ ] `LICENSE` file in repo root (MYO_Geo_Orgs Proprietary License v1.0)
- [ ] `OWNERSHIP.md` in repo root
- [ ] Copyright notice in `<head>` of HTML
- [ ] Copyright notice in JS header comment (hash-locked by CSP)
- [ ] Copyright `<meta>` tags in HTML head
- [ ] Author meta tag: `<meta name="author" content="MYO NAING TUN">`
- [ ] `SECURITY.md` with responsible disclosure
- [ ] `CODEOWNERS` pointing to `@Golem7X`
- [ ] Branch protection on `main`
- [ ] GitHub secret scanning enabled
- [ ] Commit signing enabled (GPG)

### Responding to IP Violations

If you find someone copying your work:

1. **Document** — Screenshot the infringing content with timestamps
2. **GitHub DMCA** — Submit at https://github.com/contact/dmca
3. **Google DMCA** — https://support.google.com/legal/answer/1120734
4. **Preserve evidence** — Archive infringing URLs via web.archive.org
5. **Cease and Desist** — Send via GitHub's contact or email

---

## Future Projects Under MYO_Geo_Orgs

All future applications, tools, and projects developed by MYO NAING TUN
automatically fall under this ownership framework and the MYO_Geo_Orgs
Proprietary License v1.0, unless a specific alternative license is explicitly
declared in writing for that individual project.

---

*MYO_Geo_Orgs Ownership Framework v1.0 — MYO NAING TUN — All Rights Reserved*
