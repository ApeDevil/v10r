# Analytics Collector — Activation Plan

## Status: dormant (intentional)

`src/lib/server/analytics/hook.ts` exports `analyticsCollector` but it is **not** wired into the `sequence(...)` in `src/hooks.server.ts`. Showcases currently render against synthetic/seed data, so a live collector would only pollute the dataset.

This is staged code, not residue. The hook owns non-trivial logic (consent gating, visitor hashing, session-cookie management, fire-and-forget dispatch) and a working DB schema (`src/lib/server/db/analytics/`) — deleting it would throw away decisions worth preserving.

## Activation criterion

Wire the collector when **all** of the following are true:

1. There is a real visitor population whose pageviews would be useful (i.e. the project has shipped or is in a public preview).
2. The synthetic-data seeders (`src/lib/server/db/analytics/seed.ts`, `graph-seed.ts`) are no longer needed for showcase pages — or the showcases have been moved to a separate, isolated dataset.
3. A consent banner is present in the UI and writing the `ANALYTICS_CONSENT_COOKIE` (otherwise every visitor is gated out).

## How to activate

In `src/hooks.server.ts`, insert `analyticsCollector` into the sequence **after** `sessionPopulate` and **before** `csrfProtection`:

```ts
import { analyticsCollector } from '$lib/server/analytics/hook';

export const handle = sequence(
  securityHeaders,
  loadStyle,
  i18n,
  authHandler,
  sessionPopulate,
  analyticsCollector, // ← here
  csrfProtection,
  routeGuard,
);
```

**Ordering rationale:**
- After `sessionPopulate`: the collector may want to associate events with `event.locals.user` (currently it only uses hashed visitor IDs, but the slot is reserved).
- Before `csrfProtection`: the collector observes responses, not requests — placing it earlier means it still wraps blocked-by-CSRF responses, which is undesirable. Placing it just before keeps it in the "post-auth, pre-mutation-guard" band.
- Not in `securityHeaders` band: that runs first specifically to set headers on every response including errors; analytics should not record analytics-of-errors here.

After wiring, also remove the `'src/lib/server/analytics/hook.ts'` line from the `ignore` list in `knip.config.ts` — it will then be reachable through the import chain and no longer needs the false-positive override.

## Reconsider deletion if

- Six months pass without activation, **or**
- The analytics DB schema diverges from the shape this hook writes (`recordEvent` / `upsertSession` signatures), **or**
- A different analytics provider is chosen (Plausible, PostHog, Vercel Analytics) — at that point this hook becomes vestigial and should be removed in the same change that wires the replacement.
