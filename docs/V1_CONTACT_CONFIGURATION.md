# EasyFile Tools V1 — anonymous contact form deployment guide

## Scope and staging

This patch starts from **V1 LOT5 complete** and only changes contact/footer/About/legal/privacy, adds a Cloudflare Pages Function and local tests. Conversion engines and existing CSS bundle are untouched.

**Intentional safeguards:** The Contact, Privacy and Legal pages are still `draft: true`. The forms and proposed legal wording may be reviewed using `hugo server --buildDrafts` or a private preview built with drafts; they are **not public** until all blockers below are resolved. Turnstile is disabled unless the public site key is configured. No email is sent from `hugo server` alone.

## Form fields

Kind (problem, suggestion, question, privacy concern), Tool Name, Used Browser, Operating System, Input File Format, Output File Format, Description (30 words maximum), Steps to reproduce, Error message. No name, visitor email, attachment, screenshot or visitor-IP storage in the application. No cookie or storage API is invoked by the form code. Report replies are impossible without a return address.

## Hosting setup

1. Verify the Pages deployment uses the same site source and runs Hugo (output directory `public`). Note: Cloudflare dashboard drag-and-drop **does not deploy** a `/functions/` directory; use a Git-connected Pages project or Wrangler deploy from the project root. See Cloudflare Pages documentation.
2. Create a Cloudflare Turnstile widget for the **actual production or private-preview hostnames**. Restrict widget hostnames. Copy the **public site key** to `config.toml` -> `[params] contactTurnstileSiteKey`; do not put the secret here. Use separate preview/production widgets if desired.
3. In Cloudflare Pages project settings, add encrypted environment secrets **for each target environment**:
   - `TURNSTILE_SECRET_KEY`: the **secret** from the Turnstile widget.
   - `RESEND_API_KEY`: email sender service API key (Resend).
   - `CONTACT_TO_EMAIL`: **private** mailbox receiving problem reports.
   - `CONTACT_FROM_EMAIL`: approved sender address from a domain verified with Resend, e.g. `EasyFile Tools <notifications@your-verified-domain.example>`. **Do not use a fake address.**
4. Verify your chosen domain in the Resend console with the appropriate DNS records. Do not include recipient email or credentials in any page, Hugo config, repository file or browser JavaScript.
5. Add a Cloudflare WAF rate-limiting rule for `/api/contact` if plan permits. Turnstile is anti-bot but not a rate-limit and not an abuse-proof guarantee.
6. The source includes `static/_routes.json` to invoke a Function **only for `/api/contact`**. Verify it is emitted to `public/_routes.json`; this avoids invoking billable Functions on static pages.
7. The existing `static/_headers` is a **partial** CSP and must be verified with Turnstile. The `form-action 'self'` rule allows same-site API posts. No API credentials or recipient address are sent to the browser.
8. Test staging with Turnstile and Resend configured. Confirm receipt in the private mailbox, confirm no IP/name/email/screenshot field is added to the report, and check browser Developer Tools Network responses. Avoid printing test messages in provider logs.

## Legal and privacy launch blockers — DO NOT SKIP

- Confirm the editor **actually qualifies** as a non-professional publisher under Article 1-1 II LCEN, and has provided identification to the hosting provider; non-monetization alone is not proof. If not, publish required identification or choose a lawful professional setup.
- Independently assess GDPR Article 13 controller identity and contact requirements. The LCEN public-anonymity option **does not automatically waive** GDPR disclosures for personal-data processing. An anonymous no-reply form cannot alone support individual responses to data rights requests. Seek qualified legal advice on a compliant way of handling privacy rights before public launch.
- Confirm the production legal hosting entity, contact details and privacy processors/providers. Current legal text says **expected** Cloudflare, not verified hosting contract.
- Establish actual email provider retention, recipient mailbox deletion policy and any data-transfer safeguards. Do not advertise a fictional retention deadline.
- After review, set `draft: false` for `content/contact/_index.md`, `content/privacy/_index.md`, `content/legal/_index.md`, update text to verified facts and rebuild. Never publish a working form while the Privacy and Legal pages are missing.

## Verification commands (PowerShell at project root)

```powershell
node --test tests/*.mjs
node scripts/audit-v1-links.mjs
node scripts/audit-v1-security.mjs
hugo server --buildDrafts
# inspect /contact/, /privacy/, /legal/ in local browser (server-side send cannot work in Hugo preview)
hugo --minify --cleanDestinationDir
node scripts/check-seo.mjs public
```

A Hugo production build **does not automatically deploy the Function** and Hugo local server does not execute it. Run an actual Cloudflare preview via Git/ Wrangler for real delivery tests.

## Rollback

Apply the `FICHIERS_ORIGINAUX` contents over the project, and delete files listed in `NOUVEAUX_FICHIERS_A_SUPPRIMER.txt`. No existing processing engine files are changed by this patch.
