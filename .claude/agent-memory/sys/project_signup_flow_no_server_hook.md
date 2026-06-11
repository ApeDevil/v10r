---
name: signup-flow-no-server-hook
description: Auth verify/signup terminating edge is a client-side goto, not a server redirect — no server hook fires on first signup; OAuth vs OTP have different terminating edges
metadata:
  type: project
---

The auth completion flow has NO server-side success hook today, which blocks any "first page after first signup" feature that needs to run server logic at the signup moment.

**Two distinct entry/terminating edges:**
- **OTP/magic-link**: `authClient.signIn.emailOtp()` (client) POSTs `/api/auth/...`, then on success the *client* calls `goto(data.returnTo)` (src/routes/[[locale=locale]]/auth/verify/+page.svelte:73). Terminating edge = client navigation. No `+page.server.ts` action observes success.
- **OAuth social**: `authClient.signIn.social({ callbackURL })` → provider → Better Auth server callback `/api/auth/callback/*` → server `redirect` to callbackURL. Terminating edge = server redirect inside Better Auth's handler (svelteKitHandler in hooks.server.ts authHandler).

**No first-signup detection exists.** auth config (src/lib/server/auth/index.ts) has NO `databaseHooks`/`onCreateUser`. `user.createdAt` and `updatedAt` both `defaultNow()` but Better Auth bumps `updatedAt` on session create, so `createdAt===updatedAt` is unreliable. The clean signal is Better Auth `databaseHooks.user.create.after` (fires once, server-side, only on row insert).

**Why:** consultation on a transparency-showcase "first page after first signup" (2026-06-11). **How to apply:** any feature keyed to first-signup must either add `databaseHooks` to the auth config (the one server-side door for both OTP and OAuth) or detect first-run on the destination page's server load (e.g. absence of a user_preferences row). The page itself, if under /app, generates NO analytics — analyticsCollector in src/lib/server/analytics/hook.ts excludes `/app`.

**Anonymous→user link has no column:** analytics.sessions/events key on hashed `visitorId` (v_ + 16hex SHA-256(ip:ua)) + `_v10r_sid` cookie. Only `pairedAdminUserId` exists for debug pairing; there is NO generic `userId` FK to attach an anonymous pre-signup trail to a new account. See [[project_review_2026_06_11]] for the cross-user leak context.
