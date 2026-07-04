# Native Client — the Fifth Client (Blueprint)

> **Status: planned — not built.** This documents HOW a true native mobile app would attach to the multi-client core, so the seam is proven on paper. Building it is deliberately out of scope: a second codebase with zero UI reuse is off-mission for a reference project; the installable PWA ([../pwa.md](../pwa.md)) is the shipped mobile experience.

## The claim this doc proves

[multi-client-core.md](./multi-client-core.md) names four clients (human UI, REST, AI tools, jobs) and reserves a fifth: `External API (future)` with `requireApiKey(request)`. A native app is that fifth client. Nothing in the domain layer changes — the work is all adapter-level:

| Concern | Today (web) | Fifth client (native) |
|---------|-------------|----------------------|
| Transport | Form actions + load functions | REST `+server.ts` endpoints only |
| Auth | Better Auth session cookie | **Better Auth official Expo integration** (`@better-auth/expo`): system-browser OAuth + deep link + SecureStore token, or the core `bearer` plugin (docs: "use cautiously") |
| Session | Cookie jar | `Authorization: Bearer <token>` from SecureStore |
| Google OAuth | Full-page redirect | System browser (ASWebAuthenticationSession / Custom Tabs) + deep link back — never a webview (`disallowed_useragent` hard ban) |
| Passkeys | WebAuthn, rpID = prod hostname | Native platform APIs (AASA / asset links against the same domain) |
| Dates | Serialized at the route layer | Same — the REST adapters already do this |

## What would have to be built (in order)

1. **API-key/bearer guard:** `requireApiKey(request)` in `$lib/server/auth/guards.ts` (the reserved seam), plus Better Auth `bearer` plugin enablement with an **exact-match** custom scheme entry in `trustedOrigins` (never a wildcard — trustedOrigins widening is a known account-takeover surface, GHSA-vp58-j275-797x).
2. **Contract hardening:** the `/api/*` tree is today an internal, same-origin, cookie-authed surface. A native client makes it a public contract: version it, document error shapes (`apiError` codes), and pin pagination.
3. **Expo app** consuming that contract; UI rebuilt native (zero reuse of the UnoCSS/Bits component system — this is the cost that parks the whole idea).
4. **Push:** native APNs/FCM tokens via Expo notifications — a `native-push` provider beside `web-push` in the notifications provider registry (the "one more channel" seam, again).

## Why not now

- No identified feature needs native device APIs the PWA lacks.
- Store presence has ~zero value for a zero-user reference project, and carries recurring maintenance (Apple $99/yr + review; Google target-SDK bumps).
- Every dollar of native work duplicates a UI that already exists and teaches nothing new — whereas this blueprint captures the architectural lesson (the core is client-ready) at documentation cost.

## Reconsider when

A concrete requirement appears for: background geolocation/BLE/HealthKit-class APIs, offline-first data (sync engine), or store distribution as a product goal.
