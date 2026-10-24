# External service: a separately deployed backend behind a typed client

How a SvelteKit app calls a backend that is **its own process, built, deployed and scaled on its own** — through one authoritative contract, one server-only service client, and a failure model that keeps the rest of the app alive when that process is not. The reference is a small Rust/Axum service, the **runtime lab** (`services/runtime-lab/`, an order-lifecycle rules engine), the service client is `src/lib/server/showcases/external-service/`, and the live proof is `/showcases/external-service`.

This is a pattern for a *boundary*, not a migration: v10r stays one SvelteKit app, and Rust is incidental. The contract, service client, failure model and container would be the same for a Go or Python service.

**External service** (`docs/naming.md`) means any separately deployed process the app calls over HTTP, first-party or a vendor's. This doc is about the first-party case — the one where you own both ends of the wire and can therefore make the contract executable.

---

## When to use it — and when not

Reach for a separate service when one responsibility genuinely needs a **different runtime, release cadence or resource profile** from the app: a long-lived worker, a CPU-heavy engine, a component another team or product also calls, a language-specific library.

Do not, when the work fits in a `#lib/server/[domain]/` module. A second deployable doubles the things that can be down, the configuration that can drift, and the places a credential lives. In-process alternatives are cheaper, in order: a domain module (`multi-client-core`), a Web Worker or wasm for client-side compute (`architecture-wasm-kernel`), a queue worker on the same host (`workers.md`). "Rust is faster" is not a reason by itself — see [Measurement](#measurement).

## Architecture

```
browser ── form POST ──▶ +page.server.ts ──▶ callService() ── HTTPS (+ Bearer) ──▶ runtime-lab (Rust)
           (ids only)    (honeypot, IP +      (deadline, validate,                (auth, bounds, rules,
                          global limit,        classify, time)                     Server-Timing, log)
                          sub-deadline)
```

The browser never talks to the service: no CORS, no public proxy, no credential in the page. The page sends **ids from closed lists** (`target`, `preset`, `drill`, `patience`); the server owns every URL, credential and request body.

| Where | What | Rule it follows |
|---|---|---|
| `services/runtime-lab/src/order.rs` | The domain: a pure order-lifecycle state machine | No HTTP, no serde, no clock — the same domain/adapter split as `#lib/server/[domain]/` |
| `services/runtime-lab/src/contract.rs` | Wire types + the OpenAPI document | The single authority for the API |
| `services/runtime-lab/src/http.rs` | Routes, bearer auth, body limit, request timeout, request id, `Server-Timing`, one log line | Everything observable at the boundary, nowhere else |
| `services/runtime-lab/src/main.rs` | The accept loop: header-read timeout, header-size cap, connection cap, graceful drain | Connection-level protection `axum::serve` does not expose |
| `services/runtime-lab/src/log.rs` | The one log writer: a bounded queue drained by one thread | Logging never blocks or fails a request ([why](#logging-never-stops-the-service)) |
| `services/runtime-lab/src/config.rs` | `SERVICE_TOKEN`, `SERVICE_TOKEN_PREVIOUS`, `PORT`, `HOST` | Fail closed: no valid credential, no process |
| `src/lib/server/showcases/external-service/client.ts` | `callService()` — the service client, the only way v10r calls the service | Framework-free; never throws for anything the network can do |
| `…/targets.ts` + `targets.adapter.ts` | Where the service lives (`local`, `remote`) | The only `$app/env/private` read (the adapter); origin-only URLs; TLS off private hosts |
| `…/contract.ts` | valibot mirrors of the contract + `contractDrift()` | Pinned to the generated types at compile time and to `openapi.json` at test time |
| `…/contract-skew.ts` | `contractSkew()` — a running service's `release` against this app's `CONTRACT_RELEASE` | A diagnosis shown in the lab, never a reason to refuse a call ([Evolving the contract](#evolving-the-contract)) |
| `…/lab.ts`, `…/presets.ts` | The showcase's checks, preset evaluations and drills | Demo code — not part of what you copy |
| `src/lib/showcases/external-service/` | Generated types + page-safe vocabulary; `labels.ts` resolves the page's copy in `load` | No credential or URL can exist in these types; components get strings, never per-locale message modules (each Paraglide message ships all three locales — the first version of this page cost 50 KB of client JS that way) |

`services/` is new on purpose: a separately deployed process is not a library. `crates/kernel` is compiled *into* the app; `services/runtime-lab` runs *beside* it. The directory says which (`docs/codebase-organization.md`).

**In a product**, the service client would be a domain named for what the service does — `src/lib/server/order-rules/`, say — holding `client.ts`, `contract.ts`, `targets.ts`, `targets.adapter.ts` and `config.ts` — reached through its barrel like any other domain. Here it sits under `server/showcases/` because the showcase is its only caller, and `isolation.gate.test.ts` proves that.

### The API

| Route | Auth | Answer |
|---|---|---|
| `GET /health/live` | public | `{"status":"live"}` — nothing else, because it is public |
| `GET /v1/status` | bearer | service, `release`, `uptimeMs`, operations, limits |
| `POST /v1/evaluate` | bearer | evaluates order events; `200` with `outcome: accepted \| refused` |

Liveness and identity are separate on purpose: "it is up" is public, "what it is and how long it has run" is not. A **refusal is an answer, not an error** — `200` with `outcome: "refused"` means the request was valid and a rule said no; `400` means the request was not valid. Errors use v10r's own envelope `{ error: { code, message } }` (`http/response.ts`), so the boundary introduces no second API convention.

The rules: an order is `placed`, becomes `partially_paid` and `paid` by payments (never above the total), ships only when fully paid, is delivered after shipping, can be cancelled before shipping, and can be refunded — never above what was paid — after delivery or after a cancellation; the last refunded cent makes it `refunded`. Evaluation stops at the first refused event.

## The contract chain

One authority, and every derivation checked:

```
contract.rs ──cargo test──▶ openapi.json ──external-service:contract──▶ contract.generated.ts ──svelte-check──▶ contract.ts (valibot)
```

1. **Rust → spec.** utoipa derives the OpenAPI 3.1 document from the wire types; paths come from the router itself (`utoipa_axum::routes!`), so a route and its spec entry cannot be registered apart. `openapi_json_matches_the_code` fails until `UPDATE_OPENAPI=1 cargo test` rewrites the committed file.
2. **Spec ↔ serde.** A schema generator reads attributes, not behaviour, and the two disagreed twice here: utoipa ignores `rename_all_fields` (it published `amount_cents`; serde reads `amountCents`) and does not close internally tagged enum variants (the spec admitted `{"type":"ship","amountCents":5}`, which serde refuses). Two tests now hold the published schema to serde in both directions — every response the service sends conforms, and the request schema admits exactly what serde accepts — and `contract::complete()` closes the variants.
3. **Spec → TypeScript.** `bun run external-service:contract` (openapi-typescript, types only — nothing ships to the browser) writes `contract.generated.ts`; `contract-freshness.test.ts` fails when it is stale.
4. **Types → runtime.** Types vanish at runtime and a response is untrusted input, so `contract.ts` holds valibot mirrors. `Exact<InferOutput<…>, components['schemas'][…]>` pins fail `svelte-check` on any field difference, and `contractDrift()` compares each mirror's JSON Schema with `openapi.json` — names, required, enums, closed objects and every bound keyword — and reports any keyword it does not model rather than skipping it. `contract.test.ts` proves it catches fourteen realistic breaking changes at the right path, and pins the client's operation table (path, method, auth, request/response components, error statuses) to `paths`.
5. **Rust edits without Rust in the gate.** `bun run validate` never runs cargo. `scripts/external-service/check.sh` hashes the crate's sources, its build definition and itself, runs fmt, clippy (`-D warnings`) and the tests, refuses to stamp if any input changed while they ran, and writes `check-manifest.json` with the runner it actually used. `contract-freshness.test.ts` recomputes the hashes and pins the stamped check list to the script's. A Rust edit without a passing check run turns `validate` red. Same method and the same honest limit as the wasm kernel's `build-manifest.json`: it proves "these files passed when the script last ran", not that they would on another toolchain.

Requests are validated **closed** (`strictObject`, like the service); responses **open** (`object`): a field the service adds later is ignored — additive change stays compatible — while a removed or renamed one fails both the drift test and, at runtime, validation.

## Evolving the contract

The service is deployed by hand and the app from `main`, so for a while after every change the two run different code. The drift tests prove each side matches *its own* copy of the contract; what they cannot see is the pair actually running. Three rules keep that pair safe, and one diagnosis says when it is not.

**1. The release names the contract.** `release` — the Cargo version, which is also the spec's `info.version` and what `/v1/status` reports — follows semver for the contract: releases sharing major.minor share one contract; a minor bump is additive from 1.0 on; a major bump (in 0.x, a minor one) may break. `services/runtime-lab/contract-releases.json` records release → digest of the **contract** — the spec without `info`, prose (`description`, `summary`, `title`, examples) and tags, keys sorted — so a doc-comment edit or a generator that reorders keys is not a contract change, while a field, bound, enum value or route is. `bun run external-service:contract` appends a new release, never rewrites one, and checks the rule *before* writing, so a release that breaks it never becomes history; a missing record is refused unless `--init` asks for a new one. `contract-freshness.test.ts` fails when the spec changed under a recorded release (a forgotten bump) or two releases of one major.minor carry different contracts (a patch that changed the contract), and accepts a minor or major release that changes it — all tested. Honest limit: the test sees the record as it is, not its history; a hand edit that rewrites or deletes a row passes, so review diffs to that file. A recorded release is spent even if it was never deployed: a second contract change before deploying needs another bump. It is a record, not a classifier: whether a change is additive or breaking stays the author's call, made with rule 2.

**The order, every time:** bump `version` in `Cargo.toml` → `UPDATE_OPENAPI=1 bash scripts/external-service/check.sh` → `bun run external-service:contract` (types + record) → deploy the service → deploy the app.

**2. Additive is directional — deploy in expand/contract order.** The app sends requests validated closed and reads responses open for *fields* — but closed for *enum values* (order states, refusal reasons, error codes, `operations`): a value it does not know is off-contract. So:

| Change | Safe deploy order | Why |
|---|---|---|
| Service adds a response field or a route | service first, then app | an older app ignores fields it does not know, and never calls a route it does not know |
| Service adds a value to a response enum | treat as breaking — a major (in 0.x, a minor) — unless every deployed app already tolerates unknown values | an older app reads the new value as `malformed_response` |
| App starts sending a new request field | service first | the service refuses unknown fields: `400` → `invalid_request` |
| App starts requiring a field the service only now sends | service first, and the service keeps answering in the shape older apps read | an app ahead of the service gets `malformed_response` |
| Remove or rename anything | expand (service accepts and sends both) → migrate the app → contract (remove the old) | each step is additive for the side not yet deployed |
| Roll back the service | to a release of the same major.minor; across minors only to one the deployed app accepts | the record says which releases share a contract — and a rollback also undoes the fixes in between (0.1.0 brings back the blocking log writer) |
| Roll back the app | safe when the service only added since (the service is then ahead) | from 1.0 on; in 0.x every contract change reads as `breaking` |

**3. A breaking change gets a new major (or 0.x minor) and a new path** (`/v2/…`) only when the old one must keep serving deployed callers. One first-party caller usually can follow rule 2 instead; no versioning framework.

**Keep `/v1/status` frozen.** Skew is read from it, so its shape must outlive every other change: no new required fields, no new enum values in `operations` without a major. When status itself answers off-contract, skew reads `unknown` rather than nothing.

**The diagnosis.** `contractSkew(service release, CONTRACT_RELEASE)` → `none` · `service_ahead` · `service_behind` · `breaking` · `unknown`. The lab's check shows it beside the release and `verify.ts` prints it. No call is refused on it — validation on both sides decides; skew explains a `malformed_response` (the app cannot read the answer) or an `invalid_request` (the service refuses what a newer app sends) before anyone reads a diff. Verified on 2026-10-23 with a 0.1.0 service under a 0.1.1 app: `none` (a patch apart, one digest).

**While the service is 0.x there is no additive level:** patch means "no contract change" and minor "may break", so every contract change reads as `breaking`, including the safe service-first kind. Releasing 1.0.0 gives minor bumps their additive meaning; that is a decision about the service's stability promise, left to its owner.

Considered and not adopted: **oasdiff** (breaking-change detection, supports 3.1) would need a Go binary or Docker inside `validate`; **Pact** fits several consumers that both evolve, not one first-party caller; a version header or `contract` field on every response would itself be a contract change and is redundant with `release`.

## The service client

`callService(target, operation, input, { deadline, fetch?, requestId? })` returns a value for everything the network or the service can do:

| Kind | Cause | What the caller should do |
|---|---|---|
| `unreachable` | no response: refused, reset before a response, DNS | retry later; the service is down or the address is wrong |
| `timed_out` | no complete answer in the deadline, or the service's own `408` | retry later; on a sleeping free host, after it wakes |
| `unauthorized` | `401` — the service refused the credential | fix configuration; never retry |
| `invalid_request` | `400` from the service, or rejected by the client before sending (`httpStatus: null`) | fix the request |
| `too_large` | `413` | fix the request |
| `service_error` | any other non-2xx — including an unfollowed redirect and an oversized error page | report it |
| `malformed_response` | a 2xx that is cut off, oversized, not JSON, or off-contract | report it — the contract chain should have caught this first |

What it guarantees, and where the code for each lives:

- **Bounded.** Each attempt runs inside the request's `Deadline` (`http/deadline.ts`); the route gives the call `child(8 s, reserve 0.5 s)` of the 10 s request budget. The body is read with `readTextBounded` (64 KiB). No new timeout system.
- **Retried only when safe.** `retryWithin` (`resilience/retry.ts`) runs a second attempt only for operations declared `idempotent`, and only when **no response arrived**. Once a response head is in, nothing is retried — the service has the request. A timeout is never retried: the request may have been processed, and on a waking host a retry only spends the rest of the budget waiting for the same cold start. `evaluate` is a POST but a pure function of its input, so it is declared idempotent — the declaration is per operation, not per method.
- **Least privilege.** The credential is sent only to operations marked `authenticated`; liveness gets none.
- **Not redirected.** `redirect: 'manual'`: a fixed origin stays fixed, and a redirect is classified, not followed with the credential attached.
- **Rate-limited in front, deliberately.** Every lab bucket states its failure policy instead of inheriting defaults (`LAB_LIMITER_POLICY`, `config.ts`): closed when the limiter store is slow, and when it is unavailable. The buckets share one store, so a slow store slows them all and opening one would only delay the next one's refusal; and they are the only cap on outbound calls, so on the free host's monthly hours. A wake check — up to 75 s of a function and of the host — also passes two buckets of its own (2 a minute per IP, 10 overall). `config.test.ts` runs the real `createLimiter` against a slow, a failing and an absent store. The visitor then reads "rate limited": imprecise, and the honest short answer.
- **Correlated.** Each call sends `x-request-id` — a UUID, or the caller's id when it satisfies the service's own rule (1–64 of `[A-Za-z0-9._-]`), so the id in the result always matches the service's log line. Render adds its own `Rndr-Id`; ours is independent of the host. A request id is a correlation aid, not evidence: the service adopts any well-formed id, so anyone who can reach a public route can write a log line carrying an id they have seen.
- **Timed three ways.** `roundTripMs` (fetch start → body read), `serviceMs` (the service's own `Server-Timing: app;dur=`, read with `readServerTimingMetric` beside v10r's own writer in `http/request-timing.ts`), `clientMs` (everything else). The route records them as `ext_*` spans in `locals.timing`, so they appear in v10r's own `Server-Timing` for admins (`latency-tracing`) and nowhere public.
- **Quiet.** The credential is a header and nothing else. Results carry no origin and no credential (`toPublicServiceCall`), log lines carry target id, kind, status, request id and duration, and error messages are fixed strings — except a `400`'s, which is the service's own field-level validation message, length-capped.
- **No demo switches.** `callService` has no option to override the credential or skip validation. The lab's drills pass ordinary values instead — a spent deadline, a target with a wrong credential, an operation without a request schema — so the reference client stays the thing to copy.

## Security

**A static bearer credential, server to server**, compared in constant time (`subtle::ConstantTimeEq`; only the length can leak), printable ASCII without spaces and at least 32 characters, required by the service at startup (a trailing newline from `echo` would otherwise make every caller's credential mismatch while liveness stays green). It is enough for this reference because exactly one trusted server calls the service, over TLS on the public hop, and the service holds no data. Its limits, stated plainly:

- It is **shared and static**: anyone holding it is "the app"; it carries no user identity and no per-request binding, so a captured request can be replayed until the credential is rotated.
- **Rotation** needs an overlap window, and has one — see [Rotating the credential](#rotating-the-credential). Named after v10r's key ring (`ENCRYPTION_KEY` + `ENCRYPTION_KEY_PREVIOUS`): `SERVICE_TOKEN` + `SERVICE_TOKEN_PREVIOUS`.
- It authenticates the **caller**, not the end user. Authorization of what a user may do stays in v10r; the service trusts its one caller.

Production upgrades, in rising order of effort: **OIDC workload identity** (Vercel issues short-lived OIDC tokens to functions on every plan — issuer `https://oidc.vercel.com/<team>`, subject `owner:<team>:project:<project>:environment:<env>`; the service checks `iss`, `aud`, `sub` and the signature against the issuer's JWKS — no shared secret at all), **HMAC request signing** (binds method, path, body and a timestamp; stops replay and tampering), **mTLS**, and **private networking** where both ends share a provider. Do not build a general auth framework into a service like this one; pick the smallest of these that matches the threat. **When to move past the static bearer:** when the credential guards writes, data or spend; when there is more than one caller (each needs its own identity and revocation); or when a party in the path (a proxy you do not run) must not be able to replay or alter requests — that last one is HMAC's case. None holds for the reference today.

### Rotating the credential

The service accepts `SERVICE_TOKEN` and, when set, `SERVICE_TOKEN_PREVIOUS` — held to the same rules, refused at startup when equal to the current one, and always compared too (both in constant time, so whether the second comparison runs does not depend on the first). Zero-downtime rotation, in order:

1. Generate the new credential (`openssl rand -hex 32`).
2. **Service:** `SERVICE_TOKEN` = new, `SERVICE_TOKEN_PREVIOUS` = old; deploy. Both are accepted; the `listening` log line says `"previousToken": true`.
3. **App:** `EXTERNAL_SERVICE_REMOTE_TOKEN` = new; redeploy.
4. **Wait for the old credential to stop arriving.** Every authenticated access-log line names the credential used — `"credential":"current"` or `"previous"`, a name, never the value — so the log shows when nothing presents the old one any more.
5. **Service:** remove `SERVICE_TOKEN_PREVIOUS`; deploy. The old credential is refused from here. A previous credential left set is a second valid credential indefinitely.

Locally: `EXTERNAL_SERVICE_LOCAL_TOKEN_PREVIOUS` in `.env` feeds the compose service's `SERVICE_TOKEN_PREVIOUS`.

### Against OWASP API Security Top 10 (2023)

| Risk | Applies because | Control here |
|---|---|---|
| API2 Broken Authentication | a public URL serves functional routes | bearer required by the service on every functional route; ≥32 printable chars; constant-time compare; fail-closed config; rotation without a refusal window |
| API4 Unrestricted Resource Consumption | anyone can reach the URL; the app's lab is public | 8 KiB body, ≤64 events, 16 KiB request head, 5 s head and request timeouts, 256 connections; in the app: honeypot, per-IP and global limiters, deadlines, 64 KiB bounded reads |
| API7 Server-Side Request Forgery | the app makes the outbound call | targets are server-configured ids; origin-only URLs; no redirect following; the service fetches nothing |
| API8 Security Misconfiguration | two deployables, two configs | the service refuses to start misconfigured; the client reports `misconfigured` with the rule; TLS required off private hosts; no stack traces — one error envelope; read-only, capability-free container |
| API9 Improper Inventory Management | a second, versioned API | one generated spec, `release` in `/v1/status`, `contract-releases.json`, skew reported ([Evolving the contract](#evolving-the-contract)); no debug or admin routes |
| API10 Unsafe Consumption of APIs | the app consumes the service's answers | responses validated against the contract, bounded reads, deadlines, redirects classified not followed, error bodies not trusted as prose |

API1/3/5 (object, property and function-level authorization) are the app's: the service has no users and no objects. API6 (sensitive business flows) does not apply to a pure function.

**Residual risk, accepted for the reference:** the 256-connection cap is a shared resource. A client that reconnects every 5 s, or one that sends pipelined requests and never reads the answers (hyper has no write timeout, so a pending write holds its connection), can keep the slots full and new connections — the host's health check included — are closed at accept. On Render the attacker never holds a TCP connection to the container: Render's proxy does, and it reads its answers. Exposed directly, add a write timeout around the connection's IO and a per-address cap, or put a proxy in front.

The service also protects itself at the connection level, because its public URL is reachable without the credential: an unfinished request head — and an idle keep-alive connection — is closed after 5 s (slowloris), a request head may be at most 16 KiB (`431` past it — hyper's default would buffer ~400 KiB per connection first), at most 256 connections are open at once, a request has 5 s from head to response, and everything it logs from the request (method, path, serde's messages) is clipped **by characters, never bytes** — a byte cut inside a multi-byte character panicked the request task, unauthenticated, until review caught it.

Invariants, each with its proof:

| Invariant | Proven by |
|---|---|
| Liveness discloses nothing beyond "live" | `http.rs` `liveness_is_public_and_says_nothing_else`; smoke |
| Functional routes require the credential, checked by the service | `functional_routes_refuse_missing_and_wrong_credentials`; the `credential` drill; `verify.ts` |
| Every protected path declares the bearer scheme in the contract, and the client agrees | `every_functional_route_requires_the_bearer_scheme_in_the_contract`; `contract.test.ts` operation table |
| Missing, short or malformed credential fails closed | `config.rs` tests; smoke (exit 2); client: `short_token` / `malformed_token` → `misconfigured`, nothing sent |
| Credentials never reach a client bundle, a result, a log or an error | env read only in `targets.adapter.ts` (`isolation.gate.test.ts`), `#lib/server` + `$app/env/private`; client/lab tests assert absence on success and failure paths; smoke checks container logs; the built client bundle contains no `EXTERNAL_SERVICE_` name |
| Input is bounded and validated by the service itself | 8 KiB body, ≤64 events, value ranges, `deny_unknown_fields`; `invalid_input_never_reaches_the_rules`; the `unvalidated` drill |
| Hostile bytes, slow clients and connection floods do not take the service down | `hostile_utf8_is_clipped_not_panicked_on`; smoke's unfinished-head and 20 KB-head (`431`) checks; the connection cap |
| A rotation never refuses the caller, and never weakens the credential | `config.rs` `a_previous_credential_is_optional_and_held_to_the_same_rules`; `http.rs` `the_previous_credential_is_accepted_during_a_rotation_and_nothing_else_is`; smoke |
| Logging can neither stall nor crash a request | `log.rs` tests (a writer that blocks, one that always fails); the host reproduction in [Measurement](#measurement) |
| The upstream is not caller-controlled | closed-list ids in the form; origin-only URLs; no redirect following |
| Plain HTTP never carries the credential off a private network | `remote` must be `https:`; `local` may use `http:` only to loopback, private or single-label hosts (`targets.test.ts`) |
| The public demo resists trivial abuse | honeypot (strict `renderedAt`) + per-IP and global limiters on every action, two smaller ones on a wake check, all closed when their store is slow or gone (`config.test.ts`); no network work on page load |
| No fault-injection controls exist on any host | the service has none; the client has none; drills change only what the caller sends |

## Failure model — the service is optional

Only `/showcases/external-service` depends on the service, and `isolation.gate.test.ts` makes that a property of the code: nothing outside the showcase's own directories imports the service client, statically or dynamically. A target is resolved per call from the environment, so a missing variable is an `unconfigured` target, never a module that fails to load. The page's `load` makes **no** network call — a crawler visit must not wake a sleeping host — so the page renders identically with the service up, down or absent.

The lab distinguishes four situations a single "error" would blur: **not configured** (this deploy has no such target — muted, not red), **misconfigured** (set but refused, with the rule that refused it), **unavailable** (`unreachable` / `timed_out` after a real attempt), and **ready** (liveness and authenticated status both answered within contract).

**The page says when an action did not land.** An enhanced action can end without a result: Vercel's own error page (a 504 at `maxDuration` is HTML; since SvelteKit 3 it arrives as an error carrying that response's status), a SvelteKit error result (with its status), a redirect (no lab action redirects, so one is reported, not followed), or a fetch that got no answer (a rejected fetch, which reaches the page as SvelteKit's unexpected-error default). Each shows a dismissible notice — "the server sent no result" or "never got an answer" — the spinner clears and the session history stays (`tests/browser/external-service.spec.ts` drives both by intercepting the action POST). Before 2026-10-23 these results were dropped silently.

**Cold starts.** A free host that idles takes about a minute to start, which no ordinary request budget can hold. The lab's *Check* uses the ordinary 8 s ceiling and reports a timeout honestly; *Wake and check* gives that one action its own 75 s deadline (the route declares `maxDuration: 90`), so the cold start itself is observed — and the service's `uptimeMs`, smaller than the check's own duration, says this check started the process.

### Logging never stops the service

A log reader is a dependency too. `println!` takes stdout's lock and blocks while the pipe is full, and panics when the write fails. Reproduced against the released binary (2026-10-23, [Measurement](#measurement)): a reader that stalled — a container log driver in its default *blocking* mode, a slow collector — stopped every Tokio worker, the accept loop and `/health/live` included, and SIGTERM went unanswered for over 15 s; a reader that went away turned every request into a reset connection while the process stayed up.

`log.rs` is the one writer: a request appends its line to a bounded buffer under a short lock and **never wakes anything**; one thread owns stdout, drains the buffer every 20 ms and writes the batch in one `write`, outside the lock, ignoring write errors; a line that does not fit (1024 held — a few hundred KiB at most) is **dropped and counted**, and the count is written as `{"event":"log_dropped","lines":n}` once the writer catches up; every exit path stops the runtime's remaining connections, then wakes the writer and flushes for at most 1 s, so shutdown cannot hang on a reader that is gone — the 8 s drain plus that second stays inside Docker's and Podman's default 10 s stop grace. std only. What the count cannot cover: a batch whose write fails (the reader is gone — no one is left to tell), lines emitted after the final flush, and a last line cut short when the process exits with the writer blocked.

The first version used a channel that woke the writer for every line. Measured under the free-tier envelope, that wake-up — paid from the same 0.1 CPU quota as the requests — cost a fifth of burst throughput and tripled p95 against plain `println!`; writing in batches did not help, removing the wake did. The design above is the measured winner ([Measurement](#measurement)): on a fractional CPU, a per-event cross-thread wake-up is not free. When to use it elsewhere: any service that logs from its request path to a pipe it does not control. When not: a CLI whose output *is* the product (the `openapi` subcommand keeps `println!`), or a service whose log lines are an audit record that must not be dropped — that one needs durable, blocking storage and back-pressure on purpose.

### Idle connections and the host's proxy

Since hyper 1.6 the 5 s header-read timeout also closes an idle keep-alive connection. A proxy that reuses an upstream connection the service is closing at that moment can answer `502`. Render's upstream idle timeout is undocumented and nothing like it has been observed; raising the timeout would weaken the slowloris bound, so it is measured before it is changed: `verify.ts --idle-gap-ms 6000 --idle-samples 5` sends calls after quiet gaps and prints each outcome.

## Container

One `Containerfile` for every host:

- **Build context is the service directory**, never the repo root; an allowlist `.dockerignore` admits only `Cargo.toml`, `Cargo.lock` and `src/`.
- **Builder:** the same digest-pinned `rust:1.97-slim` (Debian 13) as `scripts/wasm/build.sh` — one Rust builder for the repo, `contract-freshness.test.ts` asserts the pins agree. A `RUST_IMAGE` build arg lets a registry mirror holding the same digest substitute when Docker Hub rate-limits (`mirror.gcr.io/library/rust@sha256:…` — the digest still pins the bytes).
- **Dependency layer** via a manifest-only stub build: a source-only change rebuilds the crate, not its dependencies. Plain layers, no BuildKit cache mounts — those are not persisted by every builder (Render's are assumed cold).
- **Runtime:** `gcr.io/distroless/cc-debian13:nonroot` (digest-pinned; matches the builder's glibc; only `-debian13` distroless tags are still maintained), uid 65532, no shell. The binary is PID 1 and handles SIGTERM itself; no init process.
- **Reproducible binary.** Two `--no-cache` builds of commit `32b7f3e` on one builder produced a bit-identical binary (sha256 `d994cda4…`, 2026-10-23; also held for an earlier revision). The image digest differs between them (layer timestamps); not pursued — Render builds the image itself and no image is published.
- **Run hardened.** The process needs a socket and nothing else: compose runs it `read_only`, with `cap_drop: [ALL]` and `no-new-privileges`; `smoke.sh` runs the same flags, so a write or a capability the image starts to need fails there first. Resources stay unlimited for development.
- **No `HEALTHCHECK`.** OCI-format images (Podman's default) ignore it, distroless has no shell to run one, and Render uses its own `healthCheckPath`.
- `PORT` defaults to 8080; hosts that assign one (Render: 10000) set it. Binds `0.0.0.0` (IPv4, as Render requires).

## Local development

The service is optional and behind a compose profile, so plain `podman compose up` is unchanged.

```bash
openssl rand -hex 32          # put it in .env as EXTERNAL_SERVICE_LOCAL_TOKEN
# .env: EXTERNAL_SERVICE_LOCAL_URL=http://runtime-lab:8080
podman compose --profile external-service up -d runtime-lab
podman compose up -d --force-recreate app   # env_file is read when the container is created
podman compose stop runtime-lab             # the lab reports it unreachable; nothing else changes
```

Rust checks never run in the app container (the wasm precedent: it stays Rust-free):

| Command | What it proves |
|---|---|
| `bash scripts/external-service/check.sh` | fmt, clippy `-D warnings`, `cargo test --locked` in the pinned image; writes `check-manifest.json`. `--host` uses the host's cargo (cloud sessions) and records that. `UPDATE_OPENAPI=1` regenerates `openapi.json` |
| `bun run external-service:contract` | regenerates `contract.generated.ts` (types + `CONTRACT_RELEASE`) and appends the release to `contract-releases.json` after a version bump; refuses a release that breaks the rule. `--check` verifies both; `--init` starts a missing record |
| `bash scripts/external-service/smoke.sh` | builds the image; runs it read-only, capability-free; non-root; exit 2 without a credential; live/401/200/evaluate/400/413 over a real socket; the rotating-out credential accepted; 20 KB head → 431; worker count logged; request-id echo; unfinished head closed after 5 s; credentials absent from logs; SIGTERM → exit 0 |
| `bun run external-service:verify [-- --target remote --samples 50 --concurrency 4 --idle-gap-ms 6000 --idle-samples 5]` | the **real service client** against a running service: contract skew, every negative path, every preset's stated answer, and the measurements below. Arguments are strict (a typo exits 2); `--concurrency` is capped at 4 against `remote` |
| `bash scripts/external-service/bench.sh` | the free-tier envelope reproduced: the image under `--cpus 0.1 --memory 512m` (override with `BENCH_CPUS`/`BENCH_MEMORY`), start → live, idle and loaded memory, then `verify.ts` — controlled-lab figures, never hosted ones |
| `bash scripts/external-service/audit.sh [--host]` | cargo-deny against `deny.toml`: RustSec advisories (vulnerable, yanked, unsound, unmaintained), licenses, crates.io-only sources. Outside `validate` like `bun run audit` — it needs the network and its verdict follows the database, not the commit |

`verify.ts` runs real `src/lib/server` modules under bare Bun. They reach SvelteKit's virtual `$app/env/private` through the resilience barrel, so the script installs a two-module Bun plugin mapping `$app/env/private` (every variable `src/env.ts` declares) and `$app/env` to the process environment — the counterpart of the mock `src/lib/server/test/vitest.setup.ts` installs for tests (recorded in `docs/codebase-organization.md`).

## Hosting on Render

The `remote` target runs on Render Free: a Docker web service in Frankfurt (next to v10r's Vercel functions in `fra1`), `https://v10r-runtime-lab.onrender.com`, created by the owner on 2026-10-23 from the feature branch. Creating or changing it is the owner's decision; a payment method on the Render account is the line not to cross (see the cost checklist).

What Render Free gives, per its docs (fetched 2026-10-22 through search summaries — the sandbox could not open render.com directly; re-check in the dashboard): 750 free instance-hours per workspace per month (suspended, not billed, when used up); spin-down after 15 minutes without inbound traffic and a cold start of about a minute; 500 build-pipeline minutes per month (overage is billed **only** with a payment method on file — without one, builds stop); no persistent disk, no SSH, single instance; must bind `0.0.0.0:$PORT` (default 10000); TLS terminated at Render's proxy; SIGTERM then SIGKILL after 30 s on deploys. **Unverified:** the Free instance's CPU/RAM (a Render article says 0.1 CPU / 512 MB), Render's request timeout, Free availability per region, and whether Render's proxy forwards raw non-ASCII bytes in paths (the service is safe either way since review).

### Exact setup (dashboard → New → Web Service)

| Setting | Value |
|---|---|
| Source | the GitHub repository, branch `main` (or the feature branch for a trial) |
| Runtime / Language | **Docker** |
| Name | `v10r-runtime-lab` (becomes `https://v10r-runtime-lab.onrender.com` if free) |
| Region | **Frankfurt (EU Central)** — cannot be changed later |
| Instance type | **Free** |
| Root directory | `services/runtime-lab` — the other two paths are relative to it |
| Dockerfile path | `./Containerfile` |
| Docker build context | `.` (the service directory) |
| Docker command | *(empty — the image's `ENTRYPOINT` starts the service)* |
| Health check path | `/health/live` |
| Auto-Deploy | **Off** (deploy manually; saves pipeline minutes) |
| Build filters | none needed — with a root directory set, Render ignores changes outside it |
| Environment | `SERVICE_TOKEN` = a fresh `openssl rand -hex 32`, **only** here and in Vercel. Do **not** set `PORT` — Render injects it |

Set the root directory. The first deploy left it empty and gave repo-root paths for the Dockerfile and context; Render then sent the whole repository (8.87 MB) as the build context and the build failed at `COPY Cargo.toml` — the Containerfile expects the service directory as its context. `services/runtime-lab/render.yaml` holds the same settings as a Blueprint, for reference or for a Blueprint created with that file path. Then, in **Vercel** (server-only env vars, Production): `EXTERNAL_SERVICE_REMOTE_URL=https://<service>.onrender.com` and `EXTERNAL_SERVICE_REMOTE_TOKEN=<same value>`.

### Cost checklist

- [ ] The Render workspace has **no payment method**; the plan is Hobby; the instance type reads **Free**.
- [ ] No other paid resource is attached (no disk, no custom-domain upgrade, no paid workspace plan).
- [ ] Auto-Deploy is **Off** and the root directory is set, so unrelated pushes spend no pipeline minutes.
- [ ] The workspace runs **no other free service**: anyone can keep this one awake by hitting its public URL every <15 minutes (~744 of the 750 monthly hours, shared across the workspace) — v10r's limiters cannot see those requests. Watch instance-hours in the dashboard.
- [ ] Teardown is known: Settings → Delete Web Service; then remove the two Vercel env vars.
- [x] The vendor checklist in [`vendors.md`](../../stack/vendors.md#adding-new-vendors): Render publishes a GDPR DPA and holds SOC 2 Type II; the compliance row, `gdpr.md` and the `/showcases/privacy/data` disclosure name it. The service receives only server-owned synthetic order events and stores nothing; Render sees request metadata (the IPs of Vercel's functions, timing), never a visitor's.

### Security checklist

- [ ] The token is new, 32+ random characters (printable ASCII, no newline), used for this target only, stored only in Render and Vercel (never in the repo or a chat).
- [ ] `EXTERNAL_SERVICE_REMOTE_URL` is `https://` and an origin only; the lab shows the target as *Configured*.
- [ ] `curl https://<service>.onrender.com/v1/status` without the token → `401`; `/health/live` → `{"status":"live"}` only.
- [ ] Render's logs show one JSON line per request with no `authorization` value.

### Hosted verification (the evidence that promotes the remote half)

1. Leave the service idle for 20+ minutes, then run `EXTERNAL_SERVICE_REMOTE_URL=… EXTERNAL_SERVICE_REMOTE_TOKEN=… bun run external-service:verify -- --target remote --samples 50 --concurrency 4 --idle-gap-ms 6000 --idle-samples 5`. The first call measures the cold start; `uptimeMs` confirms the run woke the process.
2. All negative paths and all presets must pass (401, 400, 413, client rejection, every preset's answer, spent deadline).
3. On the deployed v10r, open `/showcases/external-service` after another idle period: **Wake and check** the *Remote host* card (cold — the cold-start badge must read "This check started the process"), then **Check** again (warm); run a preset and each drill.
4. Record the figures and conditions in [Measurement](#measurement), then update the pattern record (`architecture-external-service`) — its remote verification is **pending** until this is done.

## Measurement

What each figure is, and where it comes from — no figure here is estimated:

| Figure | Source |
|---|---|
| Service processing | the service's own `Server-Timing: app;dur=` — handler + middleware, inside the process |
| HTTP round trip | service client: fetch start → response body read |
| Client overhead | client total − round trip: request/response validation, parsing |
| Cold start | the first call after idle; `uptimeMs` < the check's own duration ⇒ this call started the process |
| Failure detection | time from call start to a classified failure |

**Local, 2026-10-22** — `verify.ts` against the container, cloud sandbox (Linux, 4 vCPU, Docker 29.9 rootful, loopback), Bun 1.3.12, 200 sequential `evaluate` calls per run. Two runs, to show the spread:

| | run A: process up ~10 min (p50 / p95 / max) | run B: final image, process 1 s old (p50 / p95 / max) |
|---|---|---|
| HTTP round trip | 0.74 / 2.49 / 4.49 ms | 1.39 / 4.72 / 13.04 ms |
| Service processing (`app`) | 0.03 / 0.06 / 0.08 ms | 0.06 / 0.11 / 2.47 ms |
| Client overhead | 0.12 / 0.30 / 2.04 ms | 0.25 / 0.51 / 1.63 ms |
| Client total | 0.88 / 2.88 / 4.69 ms | 1.68 / 5.14 / 13.34 ms |

Loopback figures in a shared sandbox move by ~2× between runs; read them as orders of magnitude. Failure detection: connection refused → `unreachable` in 3–34 ms (two attempts, jittered backoff); spent deadline → `timed_out` in 0.12–0.2 ms (nothing sent); a stopped container → `unreachable` in 23 ms. A **1 ms** budget lost the race to the warm local service 15–19 times in 20 across runs — which is why the lab's deadline drill uses a spent budget rather than a tiny one. Container start → first liveness answer: 318–362 ms (4 runs, image present). An unfinished request head and an idle keep-alive connection are both closed at 5.0 s. Image: 11.7 MB compressed, 46.4 MB unpacked. Build: 33 s with base images cached, 8 s for a source-only rebuild (dependency layer cached).

**Render Free, Frankfurt, 2026-10-23** — first deploy, from the build and runtime logs: dependencies compiled in 15.5 s and the crate in 4.4 s on Render's builder; Render exports the layer cache to its registry, so the manifest-only dependency layer is reused by later builds. The process bound `0.0.0.0:10000` from Render's `PORT` and logged `bootMs` 0.30 (process start to listening). Render probes `HEAD /` and `GET /` once at deploy — two `404` log lines, expected: the service has no route there.

**Production, 2026-10-23** — the lab on `www.v10r.dev` (Vercel function in `fra1`, confirmed by the log's `region=fra1`) against the runtime lab on Render Frankfurt, used by hand. The service client logs one line per *failed* call (successes log nothing), so Vercel's runtime log holds the failure paths, with each call's total client time:

| Call (drill or check) | Classified as | Client total |
|---|---|---|
| wrong credential → real `401` from Rust | `unauthorized` | 66.8 / 70.8 ms |
| input that skips client validation → real `400` from Rust | `invalid_request` | 23.9 / 34.3 ms |
| spent deadline — nothing sent | `timed_out` | 0.27–1.42 ms (4 runs) |
| a plain **Check** against the sleeping service | `timed_out` at the 8 s ceiling | 8004.8 ms |

The last row is the free tier's cold start meeting a normal budget: a sleeping Render Free service does not answer within 8 s, which is why **Wake and check** has its own 75 s deadline. The owner then confirmed the wake check, presets and drills working on the page. The `401` calls opened the sequence and carry a new TLS connection; the `400` calls that followed reused it — a cross-provider, same-city round trip of a few tens of milliseconds against ~1 ms on loopback.

**Hardening pass, 2026-10-23 — cloud sandbox, host binaries** (Linux, 4 vCPU, rustc 1.97.1, Bun 1.3.12, loopback; 4 concurrent `evaluate` clients, 3 s per request). *Before* = release 0.1.0 (`println!`), *after* = 0.1.1 (`log.rs`):

| Log reader | Before | After |
|---|---|---|
| stalled (a FIFO held open, never read) | ~535 requests served, then every request timed out; `/health/live` unanswered after 3 s; SIGTERM ignored for >15 s | 3000/3000 served; `/health/live` in ~1 ms; SIGTERM → exit 0 in 1.0 s (the bounded flush) |
| closed (the pipe's reader gone) | 5/5 requests reset, five `failed printing to stdout` panics | 5/5 answered, no panic |
| normal (stdout to a file), 5 alternating rounds × 5000 | 9063 req/s median (8329–11091), p50 0.35 ms | 9366 req/s median (8746–10790), p50 0.33 ms |

The normal-path ranges overlap — no difference is claimed on an unthrottled host. Service time (`app`) was 20–21 µs in both, and both wrote every line: 25 003 of 25 003.

**Controlled lab, 2026-10-23 — the image under the free-tier envelope** (`bench.sh`: Docker 29.9.1, `--cpus 0.1 --memory 512m`, read-only, no capabilities; 300 × `evaluate` in 4 lanes; 6 alternating rounds per build). Cgroup limits reproduce the CPU quota and memory ceiling, not Render's proxy, network or scheduler:

| Medians of 6 rounds (spread) | before — `println!` | first sink — wake per line | after — timed drain |
|---|---|---|---|
| HTTP round trip p50 | 2.89 ms (2.43–3.04) | 3.45 ms (2.77–3.72) | **2.29 ms** (2.06–2.31) |
| HTTP round trip p95 | 10.9 ms (8.2–22.1) | 35.7 ms (7.0–42.2) | **7.8 ms** (6.4–24.4) |
| burst throughput | 783 calls/s (718–837) | 633 calls/s (596–792) | **884 calls/s** (756–970) |

Same envelope, release 0.1.1: Tokio sees the quota (`"workers": 1`; 4 at `--cpus 4`); container run → first liveness answer 682 ms (442 ms at `--cpus 4`); service time 30 µs; memory 1.4–1.9 MiB idle and after a run. At 0.1 CPU the median barely moves and the tail grows: CFS throttling — 10 ms of CPU per 100 ms period — shows up as tens of ms at p95 for any build. p99 is not quoted from 300-sample runs (three values above it); `verify.ts` prints it only from 100 samples and marks it indicative.

Image: 11.6 MB compressed (`docker save | gzip`), 46.4 MB unpacked — unchanged. Build in the sandbox: 47–61 s cold (crates fetched through the sandbox's egress proxy), 12 s for a source-only change. A release build with `lto = "fat"`, `codegen-units = 1` and `panic = "abort"` was measured and rejected: binary 2.44 → 1.55 MB and `app` p50 −7 µs, for a 90 s build instead of 47 s — against a hop of tens of ms and Render's 500 free build minutes ([Rejected alternatives](#rejected-alternatives)).

**Still unmeasured — hosted:** the cold-start duration, warm success-path percentiles with the `Server-Timing` split, the cost of a new TLS connection after a quiet gap, and whether Render's proxy ever races the 5 s idle close. The sandbox's egress proxy refuses both `www.v10r.dev` and `*.onrender.com`; the `verify.ts --target remote` run in step 1 of [Hosted verification](#hosted-verification-the-evidence-that-promotes-the-remote-half) records all four.

What these numbers do **not** say: that Rust is faster. The evaluation is microseconds in any language; the boundary costs ~1 ms on loopback and will cost tens of milliseconds across a network, before any cold start. A service boundary is paid for in latency and operations — it is worth it for isolation, ownership or a runtime the app cannot host, not for speed of a small computation.

## Rejected alternatives

- **The browser calling the service directly (CORS).** Puts the credential or a public endpoint in reach of every visitor; the server-side client makes the boundary private and lets one deadline govern the whole request.
- **A generic proxy route.** A caller-supplied URL or path is an SSRF primitive; targets are named, paths fixed.
- **A Rust toolchain in the app container.** The wasm precedent: the dev container stays Rust-free and `validate` never needs cargo; the manifest carries the evidence across.
- **One Cargo workspace with `crates/kernel`.** Different deploy units, lockfiles and release cadences; a workspace would couple them for no gain.
- **A hand-written spec, `aide`, `progenitor`.** A hand-written spec is a second source of truth; `aide` (schemars) is a peer of utoipa with less axum integration; `progenitor` generates a Rust *client*, the wrong direction.
- **`openapi-fetch` or a generated runtime client.** The service client needs its own deadline, bounded read, classification and timing anyway; a runtime client would be a second layer around the same `fetch`.
- **ajv/zod for runtime validation.** valibot is already the repo's validator; the mirrors are pinned to the generated types instead.
- **RFC 9457 `problem+json`.** A fine standard, but v10r's envelope is `{ error: { code, message } }`; one convention beats two.
- **`tracing`/OpenTelemetry in the service.** One JSON line per request and `Server-Timing` cover this service; the `latency-tracing` record names OpenTelemetry as the upgrade when spans must cross processes.
- **Release-profile tuning (LTO, `codegen-units = 1`, `panic = "abort"`) and an alternative allocator.** Measured above: 7 µs off a call that crosses tens of ms of network, for double the build minutes. `panic = "abort"` would also turn any handler panic — the logging panic was one — into a process crash instead of one dropped connection. An allocator matters at high allocation rates; this process holds ~2 MiB.
- **`TCP_NODELAY` on accepted sockets.** hyper writes a small head and body in one flush; no Nagle/delayed-ACK stall (40 ms) appeared — loopback p99 1.5–2.2 ms. Revisit if responses become streamed or large.
- **A long-lived undici `Agent` for connection reuse.** Node's fetch keeps an idle connection 4 s, so most lab actions — seconds apart — open a new TLS connection. Same-metro, that costs a few tens of ms (the production `401`/`400` rows above); a module-scope Agent needs the npm `undici` package beside Node's bundled one and risks stale sockets after a Fluid instance suspends. The idle-gap series measures the cost first.
- **Hashing the bearer before the constant-time compare.** It hides the length — which, for a server-chosen random credential, is not the secret — at the price of a hash dependency.
- **A breaker around the call.** `resilience-policy` has one (`defineBreaker`); here it would fight cold starts — a waking free host fails the first calls by design, and an open breaker would keep refusing after it woke. Add one for a service that is expected to be always-on.
- **Fault-injection endpoints or flags — in the service or the client.** Anything that can make a call fail on purpose can be reached by mistake, and whatever the reference client carries gets copied. Drills change only the values a caller passes.
- **A database or any persistent state in the service.** Out of scope for the reference; it would make it a different pattern.

## Emulating this pattern

Take the boundary, not v10r: none of this needs the rest of the repository.

1. Put the service in its own directory with its own lockfile, toolchain pin and container definition; build context = that directory.
2. Make the service's wire types the authority and **generate** the spec from them; snapshot-test the spec, and test it against your serializer's real behaviour in both directions.
3. Generate client types from the spec; add a runtime validator pinned to those types; prove the drift check with deliberately broken specs, and make it fail on keywords it does not understand. Let the service's release name its contract (a patch never changes it), record release → digest of the canonical contract (no prose, sorted keys) append-only, report skew between the running pair as a diagnosis, and deploy additive changes service-first. Watch the closed-enum trap — a reader that validates enum values strictly turns a new response value into a breaking change — keep the endpoint skew is read from frozen, and leave 0.x once minor bumps should mean "additive".
4. One server-only service client, as a domain named for the service: fixed targets from server config, origin-only URLs, TLS off private hosts, a deadline per call, a bounded body read, one failure kind per cause, retries only for idempotent operations when no response arrived, no redirects, the credential only where needed, a request id, and the service's own timing header. No demo options in its signature.
5. The service authenticates every functional route itself, refuses to start without a well-formed credential, accepts a previous credential during a rotation, keeps liveness public and empty, bounds its input and its request heads, times out slow request heads, caps connections, clips what it logs by characters, and logs one line per request with no headers or bodies — through a writer that can neither block nor fail a request, and that does not wake a thread per line on a fractional CPU.
6. Keep the service optional in code: one importer, configuration read per call, no network work on page load.
7. Ship one image to every host; let the host set only the port and the secret. Run it read-only and capability-free; measure it under the host's CPU and memory envelope (a cgroup limit), not only on a developer machine; audit its dependencies outside the gate.
8. Measure before optimizing: here the hot path was 20–30 µs against tens of ms of network, so the release profile, allocator and Nagle were left alone, and the one change that moved the numbers was in logging.
