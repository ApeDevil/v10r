# Security topology

Where each control lives. The organising problem is that security in this app is
*correctly* domain-colocated — auth guards with auth, abuse controls with abuse —
which means no single directory holds it, and a reader asking "what protects
this endpoint?" has no index to consult. This is that index.

## Map

| Concern | Home |
|---|---|
| Admin authority | `$lib/server/auth/admin-ids.ts` — parses `ADMIN_USER_ID`; the single source |
| Route/endpoint guards | `$lib/server/auth/guards.ts` |
| Session revocation + ban | `$lib/server/auth/revocation.ts`, enforced in `sessionPopulate` |
| Step-up freshness | `$lib/server/auth/step-up.ts` |
| Factor-change side effects | `$lib/server/auth/factor-changes.ts` (audit, notify, revoke) |
| CSRF predicates | `$lib/server/security/csrf.ts` |
| Redirect-target validation | `$lib/server/security/safe-path.ts` |
| Response headers | `securityHeaders` in `src/hooks.server.ts` |
| CSP | `svelte.config.js` (not a hook — it is build config) |
| Rate limiting | `$lib/server/api/rate-limit.ts` + per-route limiters |
| Abuse (captcha, honeypot, per-email) | `$lib/server/abuse/` |
| MCP bearer | `$lib/server/mcp/auth.ts` |
| AI entry guard + budget | `$lib/server/ai/guard.ts` |
| Tool scope enforcement | `$lib/server/ai/tools/desk-execute.ts` |
| Tenancy in the data layer | `$lib/server/db/shared/folder-tree.ts` (`assertOwnedDestination`) |
| The gates | `$lib/server/security/*.gate.test.ts` |

## The two admin planes, and why there is now one

v10r authorises admin on `ADMIN_USER_ID`, an environment list. The property that
buys you is precise: **write access to the database does not confer admin.**

Better Auth's `admin()` plugin authorises on a `user.role` column instead. It
was enabled with zero arguments, so both planes existed at once — and the plugin
mounts ~16 endpoints under `/api/auth/admin/*`, including `impersonate-user`,
which mints a real session as another user. Since `impersonate-user` refuses to
impersonate *Better Auth* admins and the env admin is not one, the chain was:
obtain `role='admin'` → impersonate the env admin → `isAdmin()` compares
`user.id` and passes. Nothing read `session.impersonatedBy`, so the resulting
session was indistinguishable from a genuine one.

The plugin is now removed, `role` and `impersonatedBy` are dropped from the
schema, and ban/unban are direct writes. If you are tempted to re-enable it:
that reintroduces the plane, and the env-var design's only real advantage with
it.

## The `/api/auth/*` blind spot

`authHandler` answers `/api/auth/*` via `svelteKitHandler`, which returns
**without calling `resolve()`**. Everything after it in the chain therefore never
runs for that plane: `csrfProtection`, `sessionPopulate`, `consentLoader`,
`debugOwnerLoader`, `devRouteGuard`, `analyticsCollector`.

Two consequences worth knowing before you change anything there:

1. Removing `/api/auth/` from `CSRF_EXEMPT_PREFIXES` would be a **no-op**, because
   `csrfProtection` sits behind the terminator. The exemption is doubly dead.
   Better Auth's own `trustedOrigins` is what actually covers that plane.
2. Anything a Better Auth plugin mounts is outside every guard in this codebase.
   Plugin selection is therefore a security decision, not a feature decision.

## Guard families

Two families, and the prefix tells you the control flow:

- **`require*`** — throws. For `+page.server.ts` / `+layout.server.ts`, using
  Kit's own `redirect()` / `error()`.
- **`guardApi*` / `guard*Ownership`** — returns `{ error: Response }`. For
  `+server.ts`.

The split is not stylistic. SvelteKit unwraps only `HttpError` and `Redirect`; a
thrown `Response` falls through to the fatal-error path and becomes a **500**. An
earlier `requireApi*` family did exactly that, so 59 endpoints answered 500
instead of 401/403 to unauthenticated callers. `guard-contract.gate.test.ts`
pins this shut.

## Why `$lib/server/security/` is thin

It holds cross-cutting primitives with no domain owner (CSRF predicates, path
sanitisation) plus the gate tests. Everything else stays with its domain, because
moving it would relocate files without adding meaning. This document is the index
that absence otherwise costs you.
