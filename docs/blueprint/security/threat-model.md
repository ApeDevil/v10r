# Threat model

Written after a multi-agent security review of the whole codebase. It records
what is worth attacking, what stops it, and — as importantly — what has been
looked at and deliberately accepted.

## Assets, by blast radius

1. **Admin capability** — `/admin`, database operations, Neon reset, every
   user's data.
2. **Other users' desk files and RAG documents** — the only genuinely private
   per-user content.
3. **The shared docs corpus** — poisoning it reaches every chatbot answer, not
   one user's.
4. **The LLM budget and the email-sending capability** — spendable, and abusing
   the latter damages domain reputation, which is not recoverable by a rollback.
5. **Analytics/PII store**, **R2 objects**, **MCP demo state**, **`mcp.call_log`**
   (a second, separately-sensitive MCP asset: retained caller-supplied query text,
   plus the private lane's `response_text`/`workspace` — operator-authored questions
   and v10r's own registry answers, bearer-gated, no third-party data by construction).

## Adversaries

| Class | Reaches |
|---|---|
| Unauthenticated internet | Public MCP, blog, auth endpoints, media proxies, pairing claim |
| Authenticated low-privilege user | The largest surface — ~99 API endpoints, each self-guarded |
| A document the user ingested | Prompt injection, with persistence: it fires on every later retrieval |
| A compromised npm dependency | Everything. This is why `bun audit` and the `minimumReleaseAge` install cooldown exist |
| A stolen session cookie | Everything that user has, and — until step-up was added to passkey registration — durable access that survived signing out |
| A leaked environment variable | `PAIRING_SECRET`, `MCP_ADMIN_TOKEN`, `MCP_PRIVATE_TOKEN`, `MCP_TELEMETRY_SALT`, `CRON_SECRET`, the Neon URL |

## Trust boundaries

- **The handle chain.** IP is stamped once, first, from `getClientAddress()`.
  Everything downstream keys off `locals.clientIp` and never re-derives it from
  headers.
- **`/api/auth/*` is outside the chain.** See [topology](topology.md). Plugin
  selection there is a security decision.
- **Per-endpoint guards.** No global authz handler; the coverage gate is what
  makes that survivable.
- **The LLM tool loop.** `userId` is captured in a closure and never model-
  supplied, so a prompt injection can misuse the *user's own* authority but
  cannot cross to another user.
- **Tenancy in queries.** Every `[id]` route pushes `user.id` into the WHERE
  clause, so "not yours" and "doesn't exist" are indistinguishable.
- **Caller-supplied `query_text` reaches the admin usage dashboard.** Retained
  no-match MCP queries originate from an unauthenticated public endpoint and
  render to an operator, often mid coding-agent session. Two controls: text
  stays hidden until ≥3 distinct callers have asked it (k-anonymity and
  anti-poisoning), and it renders in text position only — never into `href`,
  `style`, or `data-*`. The private lane's text (`query_text` on every outcome,
  `response_text` previews) renders on the same page WITHOUT the threshold —
  acceptable because writing it requires `MCP_PRIVATE_TOKEN`: the author is the
  operator reading it. It keeps the text-position-only rendering rule.

## Deliberately accepted

- **`toolScopes` is client-declared.** It is a consent preference, not a
  boundary: Valibot pins the values, and every desk mutation is `userId`-scoped
  underneath, so asserting extra scopes lets a caller act on *their own* data
  without ticking the box. Making it a boundary needs a per-user permission
  store that does not exist. The place it mattered — approval replay — is closed
  by freezing `grantedScopes` on the proposal.
- **Failed email probes consume no quota.** Counting them would re-introduce the
  lockout DoS the peek-then-record design exists to prevent. The response is
  made uniform instead, so the cheap probe learns nothing.
- **Broad per-IP limiters fail open** when Upstash is slow. Blanket fail-closed
  turns a latency blip into a total sign-in outage. Only the small-keyspace
  buckets — 2FA verify, per-recipient email — fail closed.
- **The pairing cookie has no revocation list.** It grants analytics
  *attribution* only and never feeds an authz decision; a per-request Redis
  lookup would cost every request to revoke a short-lived debug marker.
- **`bun audit` is a periodic check, not a gate step.** It was wired into
  `validate` and pulled straight back out: the first real run returned 31
  advisories, and all but four were transitive with no top-level fix available
  (`tar`/`brace-expansion` via `@vercel/nft`, `undici` via `vitest`→`jsdom`,
  `kysely` via three separate parents, `postcss` via `vite`). A gate that cannot
  go green regardless of the diff does not get satisfied, it gets bypassed — and
  it would have blocked shipping this security work indefinitely. Run
  `bun run audit` deliberately; treat *direct* dependencies in the output as
  actionable and triage the transitive tail.

## Deliberately not built

With reasons, so they are not re-proposed:

- **Postgres RLS** — the Neon HTTP driver is stateless per query; `SET LOCAL`
  cannot ride along. Adopting it means downgrading the driver app-wide.
- **COEP** — would require auditing every third-party resource origin for a
  benefit this app does not use.
- **Removing `style-src 'unsafe-inline'`** — 105 files use Svelte transitions,
  which write per-frame inline styles. `script-src` is strict, which is where
  XSS actually lives.
- **Full OAuth 2.1 for the admin MCP endpoint** — it exposes a demo singleton to
  one operator. Standing up a token-issuance surface to satisfy a conformance
  checkbox would be a strictly larger attack surface than the static bearer it
  replaced.

## Known gaps

- ~~**OAuth access/refresh tokens are stored in plaintext** in `auth.account`~~
  — **closed.** The reasoning here was right about the hazard and wrong about
  the remedy: encrypting the columns by hand would indeed have broken Better
  Auth's refresh path, but the framework has a supported flag for exactly this,
  `account.encryptOAuthTokens`, so neither hand-rolled ciphertext nor dropping
  persistence was necessary. Enabled in `auth/index.ts`. Rows written before it
  stay plaintext; nothing reads them, and the next sign-in overwrites them.

  Still open, and smaller: **provider tokens are not revoked on account
  deletion.** The `auth.account` row only cascades away via its user FK, so a
  deleted user's GitHub/Google refresh token stays valid at the provider until
  it expires. That needs an outbound call on the erasure path, with a failure
  there not blocking the erasure itself — a separate change from this one, and
  much less pressing now that the at-rest exposure is closed.
- **The GDPR export returns counts, not content**, for desk files, AI
  conversations, and images. Those sections are now marked `portable: false`
  rather than overclaiming; comments and palettes return full content.
