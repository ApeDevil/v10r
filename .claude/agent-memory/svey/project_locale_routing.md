---
name: project-locale-routing
description: Paraglide v2 [[locale=locale]] migration — all page routes moved under optional locale segment, /api stays unprefixed
metadata:
  type: project
---

All page routes live under `src/routes/[[locale=locale]]/` as of 2026-05-16. `src/routes/api/` stays at the routes root (unprefixed).

**Why:** sveltejs/kit#11879 — universal `reroute` hook does not work with adapter-vercel multi-function deployments. Paraglide team-endorsed fix is optional `[[locale=locale]]` segment + `paraglideMiddleware` (already present in hooks.server.ts). No translated pathnames are used, so the trade-off costs nothing.

**How to apply:**
- New page routes go inside `src/routes/[[locale=locale]]/` (or a subgroup within it)
- New API/webhook/cron endpoints go in `src/routes/api/` (outside locale segment) to stay at unprefixed `/api/...` paths
- `src/hooks.ts` (reroute) is deleted — do not recreate it
- `src/params/locale.ts` provides the matcher (`en|de|ru`)
- devRouteGuard in hooks.server.ts uses `includes('/(dev)/')` (not `startsWith`) because route IDs are now `/[[locale=locale]]/(dev)/...`
- vercel.json cron paths `/api/cron/...` are unaffected (api stays unprefixed)
