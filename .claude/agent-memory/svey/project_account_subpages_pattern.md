---
name: account-subpages-pattern
description: app/account sub-areas (data, security) are Card links from account/+page.svelte, NOT tabs in app/+layout.svelte; auth pages are client-call-driven not Superforms
metadata:
  type: project
---

Sub-areas of `app/account` are reached via a `<Card>` + `<Button href>` on `account/+page.svelte`, NOT as tabs in `app/+layout.svelte`.

**Why:** the `tabs` array in `app/+layout.svelte` is reserved for top-level app sections (Dashboard / Account / Notifications). `account/data` (the GDPR transparency page) set the precedent — it is a Card link on `account/+page.svelte` (the "Your Data" card), not a tab. Keeping the tab bar at three items.

**How to apply:** when adding any `app/account/*` sub-page (e.g. `account/security` for 2FA/passkeys), add a matching `<Card>` to `account/+page.svelte` linking `localizeHref('/app/account/<sub>')`. Only reach for a sub-tab-bar (the `admin/access/` NavTab pattern from [[admin-nav-dual-registry]]) if Account grows many sub-pages.

**Auth pages are client-call-driven, not Superforms:** `auth/login` and `auth/verify` `+page.svelte` call `authClient.*` directly, hold flow state in `$state`, `goto()` on success. Their `+page.server.ts` only sanitizes `returnTo` and guards already-logged-in. New auth/security management pages follow this same shape — SSR the read-only list via a thin server load (DTO must never leak passkey publicKey/credentialID/counter/aaguid), mutate via client `authClient` calls + `invalidateAll()`. This surface is intentionally JS-required (WebAuthn has no non-JS path); do NOT convert its mutations to form actions.

**Route naming rule (settled with ARY):** all route segments are lowercase kebab-case spelled-out words; numeric abbreviations banned (verified: zero numeric segments in src/routes). So `auth/two-factor` not `auth/2fa`; `app/account/security` (honest superset name covering passkeys + TOTP).
