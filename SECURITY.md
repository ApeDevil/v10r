# Security Policy

Velociraptor (v10r) is a full-stack reference and test sandbox. It is not a
product with users' data in it, but it is deployed publicly, and the patterns in
it are meant to be copied — so a flaw here propagates.

## Reporting a vulnerability

Email **stas-k@gmx.de** with `[v10r security]` in the subject.

Please include what you did, what happened, and what you expected. A minimal
reproduction is worth more than a scanner report. If you would like a reply in
under a week, say so — this is a solo project, not a team with a rota.

Please do not open a public issue for anything exploitable.

There is no bug bounty. There is no legal threat either: test against your own
deployment, do not touch other people's data, and do not degrade the service for
anyone else, and we have no quarrel.

## Scope

In scope: the application source in this repository, and the deployed instance.

Out of scope: findings that only apply to a configuration nobody runs, missing
headers with no demonstrated impact, automated-scanner output with no
exploitation path, and denial of service by volume.

## What this project deliberately does not do

Stated so nobody spends time reporting them as findings:

- **`style-src 'unsafe-inline'`.** Svelte transitions write per-frame inline
  styles that cannot be nonced or hashed. `script-src` carries no
  `'unsafe-inline'`, which is where the XSS risk actually lives.
- **No COEP.** Cross-origin isolation would require auditing every third-party
  resource origin for a benefit this app does not use.
- **No Postgres RLS.** The Neon HTTP driver is stateless per query, so
  `SET LOCAL` cannot ride along; adopting RLS would mean downgrading the driver
  across the whole app. Tenancy is enforced in the query layer and policed by a
  static gate instead — see `src/lib/server/security/*.gate.test.ts`.
- **Admin is an environment variable**, not a database column. `ADMIN_USER_ID`
  is the only source of admin authority. This is deliberate: it means write
  access to the database does not confer admin. The Better Auth `admin()` plugin
  is not enabled for exactly this reason.

## Verifying a claim

`bun run validate` runs the full gate, including the security gates:

| Gate | What it prevents |
|---|---|
| `authz-coverage.gate.test.ts` | An endpoint shipping with no guard and no stated reason |
| `guard-contract.gate.test.ts` | Guards throwing a `Response` (SvelteKit turns that into a 500, not a 401) |
| `ownership-predicate.gate.test.ts` | Writing a caller-supplied parent FK without proving the destination is theirs |
| `handle-chain.gate.test.ts` | Silent reordering of the middleware chain |
| `load-leak-gate.test.ts` | Serialising the raw user/session to the client |
| `sql-injection-guard.test.ts` | `sql.raw` reaching a new file unreviewed |
| `safe-path.test.ts` | Open redirects via protocol-relative or backslash paths |

Dependency advisories are checked separately with `bun run audit`, on purpose —
see [threat-model.md](docs/blueprint/security/threat-model.md) for why that one
is not a gate step.
