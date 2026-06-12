---
name: env-and-primitives
description: env vars read via $env/dynamic/private in server code (requireEnv helper); no PUBLIC_ flags / no $env/static; Input primitive forwards arbitrary HTMLInputAttributes
metadata:
  type: reference
---

**Env var access:** server code reads env via `import { env } from '$env/dynamic/private'` then a `requireEnv(name)` helper that throws on missing. Canonical example: `src/lib/server/auth/index.ts`. No `$env/static/*` and no `PUBLIC_*` vars anywhere in the repo. To feature-flag by deployment (e.g. disable passkey enrollment on Vercel previews) read `env.VERCEL_ENV !== 'preview'` in a `+page.server.ts` load and pass a boolean to the page — NOT the DB `systemConfig` admin-flags system (that's for admin toggles, not infra facts). `VERCEL_ENV` is undefined locally → flag stays "on" in `bun dev`.

**DB admin flags** are a separate system: `src/lib/server/admin/flags.ts` (getFlag/setFlag over `systemConfig` table, in-process cached). Use only for admin-controllable toggles.

**Input primitive forwards attributes:** `src/lib/components/primitives/input/Input.svelte` extends `HTMLInputAttributes` and spreads `{...restProps}` after `bind:value`. Arbitrary attrs (`autocomplete`, `inputmode`, `aria-*`) pass straight through — no primitive edit needed to set e.g. `autocomplete="username webauthn"`.

**QR codes server-side:** `qrcode@^1.5.4` is installed and already used in `src/lib/server/pairing/qr.ts`. Generate QR data URLs in a load/action and pass the string to the page — no client-side qrcode import.
