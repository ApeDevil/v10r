# Security

How authority is established in v10r, where the controls live, and what stops
them from silently regressing.

| File | Topics |
|------|--------|
| [topology.md](topology.md) | Where every security control lives · the two admin planes and why only one exists now · the `/api/auth/*` blind spot · guard families |
| [threat-model.md](threat-model.md) | Assets and adversaries · trust boundaries · what is deliberately accepted · what is deliberately not built |
| [gate-tests.md](gate-tests.md) | The static-scan-as-gate pattern · each gate and what it prevents · honest limits · how to add one |

## The one-paragraph version

Admin authority is the `ADMIN_USER_ID` environment list and nothing else — no
database column confers it, which is why the Better Auth `admin()` plugin is not
enabled. Session authority is a Better Auth cookie, checked in `sessionPopulate`
against a Redis revocation epoch so that revoking or banning bites immediately
rather than after the 5-minute cookie cache. Endpoint authority is per-route:
SvelteKit cannot gate a `+server.ts` by folder position, so every endpoint calls
a `guardApi*` itself and a gate test asserts that each one either does, or is
allowlisted with a written reason.
