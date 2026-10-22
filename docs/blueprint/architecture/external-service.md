# External service: a separately deployed backend behind a typed adapter

How a SvelteKit app calls a backend that is **its own process, built, deployed and scaled on its own** — through one authoritative contract, one server-only adapter, and a failure model that keeps the rest of the app alive when that process is not. The reference is a small Rust/Axum service (`services/order-rules/`), the adapter is `src/lib/server/showcases/external-service/`, and the live proof is `/showcases/external-service`.

This is a pattern for a *boundary*, not a migration: v10r stays one SvelteKit app, and Rust is incidental. The contract, adapter, failure model and container would be the same for a Go or Python service.

**External service** (`docs/naming.md`) means any separately deployed process the app calls over HTTP, first-party or a vendor's. This doc is about the first-party case — the one where you own both ends of the wire and can therefore make the contract executable.

---

## When to use it — and when not

Reach for a separate service when one responsibility genuinely needs a **different runtime, release cadence or resource profile** from the app: a long-lived worker, a CPU-heavy engine, a component another team or product also calls, a language-specific library.

Do not, when the work fits in a `$lib/server/[domain]/` module. A second deployable doubles the things that can be down, the configuration that can drift, and the places a credential lives. In-process alternatives are cheaper, in order: a domain module (`multi-client-core`), a Web Worker or wasm for client-side compute (`architecture-wasm-kernel`), a queue worker on the same host (`workers.md`). "Rust is faster" is not a reason by itself — see [Measurement](#measurement).

## Architecture

```
browser ── form POST ──▶ +page.server.ts ──▶ callService() ── HTTPS + Bearer ──▶ order-rules (Rust)
           (ids only)    (honeypot, IP limit,  (deadline, validate,               (auth, bounds, rules,
                          sub-deadline)         classify, time)                    Server-Timing, log)
```

The browser never talks to the service: no CORS, no public proxy, no credential in the page. The page sends **ids from closed lists** (`target`, `scenario`, `drill`); the server owns every URL, credential and request body.

| Where | What | Rule it follows |
|---|---|---|
| `services/order-rules/src/order.rs` | The domain: a pure order-lifecycle state machine | No HTTP, no serde, no clock — the same domain/adapter split as `$lib/server/[domain]/` |
| `services/order-rules/src/contract.rs` | Wire types + the OpenAPI document | The single authority for the API |
| `services/order-rules/src/http.rs` | Routes, bearer auth, body limit, timeout, request id, `Server-Timing`, one log line | Everything observable at the boundary, nowhere else |
| `services/order-rules/src/config.rs` | `SERVICE_TOKEN`, `PORT`, `HOST` | Fail closed: no valid credential, no process |
| `src/lib/server/showcases/external-service/client.ts` | `callService()` — the only way v10r calls the service | Framework-free; never throws for anything the network can do |
| `…/targets.ts` + `targets.adapter.ts` | Where the service lives (`local`, `remote`) | The only `$env` read; origin-only URLs; `https` for remote |
| `…/contract.ts` | valibot mirrors of the contract + `contractDrift()` | Pinned to the generated types at compile time and to `openapi.json` at test time |
| `src/lib/showcases/external-service/` | Generated types + page-safe vocabulary | No credential or URL can exist in these types |

`services/` is new on purpose: a separately deployed process is not a library. `crates/kernel` is compiled *into* the app; `services/order-rules` runs *beside* it. The directory says which.

### The API

| Route | Auth | Answer |
|---|---|---|
| `GET /health/live` | public | `{"status":"live"}` — nothing else, because it is public |
| `GET /v1/status` | bearer | service, `release`, `uptimeMs`, operations, limits |
| `POST /v1/evaluate` | bearer | evaluates order events; `200` with `outcome: accepted \| refused` |

Liveness and identity are separate on purpose: "it is up" is public, "what it is and how long it has run" is not. A **refusal is an answer, not an error** — `200` with `outcome: "refused"` means the request was valid and a rule said no; `400` means the request was not valid. Errors use v10r's own envelope `{ error: { code, message } }` (`http/response.ts`), so the boundary introduces no second API convention.

## The contract chain

One authority, and every derivation checked:

```
contract.rs ──cargo test──▶ openapi.json ──external-service:contract──▶ contract.generated.ts ──svelte-check──▶ contract.ts (valibot)
```

1. **Rust → spec.** utoipa derives the OpenAPI 3.1 document from the wire types; paths come from the router itself (`utoipa_axum::routes!`), so a route and its spec entry cannot be registered apart. `openapi_json_matches_the_code` fails until `UPDATE_OPENAPI=1 cargo test` rewrites the committed file.
2. **Spec ↔ serde.** A schema generator reads attributes, not behaviour, and the two have already disagreed twice here: utoipa ignores `rename_all_fields` (it published `amount_cents`; serde reads `amountCents`) and does not close internally tagged enum variants (the spec admitted `{"type":"ship","amountCents":5}`, which serde refuses). Two tests now hold the published schema to serde in both directions — every response the service sends conforms, and the request schema admits exactly what serde accepts — and `contract::complete()` closes the variants.
3. **Spec → TypeScript.** `bun run external-service:contract` (openapi-typescript, types only — nothing ships to the browser) writes `contract.generated.ts`; `contract-freshness.test.ts` fails when it is stale.
4. **Types → runtime.** Types vanish at runtime and a response is untrusted input, so `contract.ts` holds valibot mirrors. `Exact<InferOutput<…>, components['schemas'][…]>` pins fail `svelte-check` on any field difference, and `contractDrift()` compares each mirror's JSON Schema with `openapi.json` (names, required, enums, bounds, closed objects). `contract.test.ts` proves the check catches nine realistic breaking changes — a removed or renamed field, a renamed enum value, a new required request field, a tightened bound, a removed variant, a reopened request, a new error code, a removed component.
5. **Rust edits without Rust in the gate.** `bun run validate` never runs cargo. `scripts/external-service/check.sh` runs fmt, clippy (`-D warnings`) and the tests and, only when all pass, writes `check-manifest.json` with hashes of the sources and `openapi.json`; `contract-freshness.test.ts` recomputes them. A Rust edit without a passing check run turns `validate` red. Same method and the same honest limit as the wasm kernel's `build-manifest.json`: it proves "these files passed when the script last ran", not that they would on another toolchain.

Requests are validated **closed** (`strictObject`, like the service); responses **open** (`object`): a field the service adds later is ignored — additive change stays compatible — while a removed or renamed one fails both the drift test and, at runtime, validation.

## The adapter

`callService(target, operation, input, { deadline, fetch?, requestId? })` returns a value for everything the network or the service can do:

| Kind | Cause | What the caller should do |
|---|---|---|
| `unreachable` | refused, reset, DNS — nothing answered | retry later; the service is down or the address is wrong |
| `timed_out` | no complete answer in the deadline, or the service's own `408` | retry later; on a sleeping free host, after it wakes |
| `unauthorized` | `401` — the service refused the credential | fix configuration; never retry |
| `invalid_request` | `400` from the service, or refused by the adapter before sending (`httpStatus: null`) | fix the request |
| `too_large` | `413` | fix the request |
| `service_error` | any other non-2xx, including an unfollowed redirect | report it |
| `malformed_response` | a 2xx that is oversized, not JSON, or off-contract | report it — the contract chain should have caught this first |

What it guarantees, and where the code for each lives:

- **Bounded.** Each attempt runs inside the request's `Deadline` (`http/deadline.ts`); the route gives the call `child(8 s, reserve 0.5 s)` of the 10 s request budget. The body is read with `readTextBounded` (64 KiB). No new timeout system.
- **Retried only when safe.** `retryWithin` (`resilience/retry.ts`) runs a second attempt only for operations declared `idempotent`, and only on `unreachable`. A timeout is not retried: the request may have been processed, and on a waking host a retry only spends the rest of the budget waiting for the same cold start. `evaluate` is a POST but a pure function of its input, so it is declared idempotent — the declaration is per operation, not per method.
- **Not redirected.** `redirect: 'manual'`: a fixed origin stays fixed, and a redirect is classified, not followed with the credential attached.
- **Correlated.** Each call sends `x-request-id` (a UUID unless the caller passes one); the service echoes it and puts it in its log line, so one id threads both processes' logs. Render adds its own `Rndr-Id`; ours is independent of the host.
- **Timed three ways.** `roundTripMs` (fetch start → body read), `serviceMs` (the service's own `Server-Timing: app;dur=`), `adapterMs` (everything else). The route records them as `ext_*` spans in `locals.timing`, so they appear in v10r's own `Server-Timing` for admins (`latency-tracing`) and nowhere public.
- **Quiet.** The credential is a header and nothing else. Results carry no origin and no credential (`toPublicServiceCall`), log lines carry target id, kind, status, request id and duration, and error messages are fixed strings — except a `400`'s, which is the service's own field-level validation message, length-capped.

## Security

**A static bearer credential, server to server**, compared in constant time (`subtle::ConstantTimeEq`; only the length can leak), at least 32 characters, required by the service at startup. It is enough for this reference because exactly one trusted server calls the service, over TLS on the public hop, and the service holds no data. Its limits, stated plainly:

- It is **shared and static**: anyone holding it is "the app"; it carries no user identity and no per-request binding, so a captured request can be replayed until the credential is rotated.
- **Rotation** needs an overlap window: accept two credentials (`SERVICE_TOKEN` and a `SERVICE_TOKEN_NEXT`), switch the caller, retire the old one. Not built — one credential per target is the reference.
- It authenticates the **caller**, not the end user. Authorization of what a user may do stays in v10r; the service trusts its one caller.

Production upgrades, in rising order of effort: **OIDC workload identity** (Vercel issues short-lived OIDC tokens to functions; the service verifies them against Vercel's JWKS — no shared secret at all), **HMAC request signing** (binds method, path, body and a timestamp; stops replay and tampering), **mTLS**, and **private networking** where both ends share a provider. Do not build a general auth framework into a service like this one; pick the smallest of these that matches the threat.

Invariants, each with its proof:

| Invariant | Proven by |
|---|---|
| Liveness discloses nothing beyond "live" | `http.rs` `liveness_is_public_and_says_nothing_else`; smoke |
| Functional routes require the credential, checked by the service | `functional_routes_refuse_missing_and_wrong_credentials`; the `credential` drill; `verify.ts` |
| Every protected path declares the bearer scheme in the contract | `every_functional_route_requires_the_bearer_scheme_in_the_contract` |
| Missing or short credential fails closed | `config.rs` tests; smoke (exit 2); adapter `short_token` → `misconfigured`, nothing sent |
| Credentials never reach a client bundle, a result, a log or an error | env read only in `targets.adapter.ts` (`isolation.gate.test.ts`), `$lib/server` + `$env/dynamic/private`; client/lab tests assert absence; smoke checks container logs |
| Input is bounded and validated by the service itself | 8 KiB body, ≤64 events, value ranges, `deny_unknown_fields`; `invalid_input_never_reaches_the_rules`; the `unvalidated` drill |
| The upstream is not caller-controlled | closed-list ids in the form; origin-only URLs; no redirect following |
| Plain HTTP never crosses the internet | `remote` target must be `https:` (`targets.test.ts`) |
| The public demo resists trivial abuse | honeypot + IP limiter on every action; no network work on page load |
| No fault-injection controls exist on any host | the service has none; drills change only what the adapter sends |

## Failure model — the service is optional

Only `/showcases/external-service` depends on the service, and `isolation.gate.test.ts` makes that a property of the code: nothing outside the showcase's own directories imports the adapter. A target is resolved per call from the environment, so a missing variable is an `unconfigured` target, never a module that fails to load. The page's `load` makes **no** network call — a crawler visit must not wake a sleeping host — so the page renders identically with the service up, down or absent.

The lab distinguishes four situations a single "error" would blur: **not configured** (this deploy has no such target — muted, not red), **misconfigured** (set but refused, with the rule that refused it), **unavailable** (`unreachable` / `timed_out` after a real attempt), and **ready** (liveness and authenticated status both answered within contract).

## Container

One `Containerfile` for every host:

- **Build context is the service directory**, never the repo root; an allowlist `.dockerignore` admits only `Cargo.toml`, `Cargo.lock` and `src/`.
- **Builder:** the same digest-pinned `rust:1.97-slim` (Debian 13) as `scripts/wasm/build.sh` — one Rust builder for the repo, `contract-freshness.test.ts` asserts the pins agree. A `RUST_IMAGE` build arg lets a registry mirror holding the same digest substitute when Docker Hub rate-limits (`mirror.gcr.io/library/rust@sha256:…` — the digest still pins the bytes).
- **Dependency layer** via a manifest-only stub build: a source-only change rebuilds the crate, not its dependencies. Plain layers, no BuildKit cache mounts — those are not persisted by every builder (Render's are assumed cold).
- **Runtime:** `gcr.io/distroless/cc-debian13:nonroot` (digest-pinned; matches the builder's glibc; only `-debian13` distroless tags are still maintained), uid 65532, no shell. The binary is PID 1 and handles SIGTERM itself; no init process.
- **No `HEALTHCHECK`.** OCI-format images (Podman's default) ignore it, distroless has no shell to run one, and Render uses its own `healthCheckPath`.
- `PORT` defaults to 8080; hosts that assign one (Render: 10000) set it. Binds `0.0.0.0` (IPv4, as Render requires).

## Local development

The service is optional and behind a compose profile, so plain `podman compose up` is unchanged.

```bash
openssl rand -hex 32          # put it in .env as EXTERNAL_SERVICE_LOCAL_TOKEN
# .env: EXTERNAL_SERVICE_LOCAL_URL=http://order-rules:8080
podman compose --profile external-service up -d order-rules
podman compose up -d --force-recreate app   # env_file is read when the container is created
podman compose stop order-rules   # the lab reports it unreachable; nothing else changes
```

Rust checks never run in the app container (the wasm precedent: it stays Rust-free):

| Command | What it proves |
|---|---|
| `bash scripts/external-service/check.sh` | fmt, clippy `-D warnings`, `cargo test --locked` in the pinned image; writes `check-manifest.json`. `--host` uses the host's cargo (cloud sessions). `UPDATE_OPENAPI=1` regenerates `openapi.json` |
| `bun run external-service:contract` | regenerates `contract.generated.ts` after a contract change |
| `bash scripts/external-service/smoke.sh` | builds the image; non-root; exit 2 without a credential; live/401/200/evaluate/400/413 over a real socket; request-id echo; credential absent from logs; SIGTERM → exit 0 |
| `bun run external-service:verify [-- --target remote --samples 50]` | the **real adapter** against a running service: every negative path, and the measurements below |

## Hosting on Render (prepared, not deployed)

Render Free is the hosting candidate: a Docker web service, Frankfurt (next to v10r's Vercel functions in `fra1`). **Nothing has been created.** Creating the service is the owner's decision and a separate approval; a payment method on the Render account is the line not to cross (see the cost checklist).

What Render Free gives, per its docs (fetched 2026-10-22 through search summaries — the sandbox could not open render.com directly; re-check in the dashboard): 750 free instance-hours per workspace per month (suspended, not billed, when used up); spin-down after 15 minutes without inbound traffic and a cold start of about a minute; 500 build-pipeline minutes per month (overage is billed **only** with a payment method on file — without one, builds stop); no persistent disk, no SSH, single instance; must bind `0.0.0.0:$PORT` (default 10000); TLS terminated at Render's proxy; SIGTERM then SIGKILL after 30 s on deploys. **Unverified:** the Free instance's CPU/RAM (a Render article says 0.1 CPU / 512 MB), Render's request timeout, Free availability per region.

### Exact setup (dashboard → New → Web Service)

| Setting | Value |
|---|---|
| Source | the GitHub repository, branch `main` (or the feature branch for a trial) |
| Runtime / Language | **Docker** |
| Name | `v10r-order-rules` (becomes `https://v10r-order-rules.onrender.com` if free) |
| Region | **Frankfurt (EU Central)** — cannot be changed later |
| Instance type | **Free** |
| Root directory | *(empty — repo root)* |
| Dockerfile path | `./services/order-rules/Containerfile` |
| Docker build context | `./services/order-rules` |
| Health check path | `/health/live` |
| Auto-Deploy | **Off** (deploy manually; saves pipeline minutes) |
| Build filters (included paths) | `services/order-rules/**` |
| Environment | `SERVICE_TOKEN` = a fresh `openssl rand -hex 32`, **only** here and in Vercel. Do **not** set `PORT` — Render injects it |

`services/order-rules/render.yaml` holds the same settings as a Blueprint, for reference or for a Blueprint created with that file path. Then, in **Vercel** (server-only env vars, Production): `EXTERNAL_SERVICE_REMOTE_URL=https://<service>.onrender.com` and `EXTERNAL_SERVICE_REMOTE_TOKEN=<same value>`.

### Cost checklist

- [ ] The Render workspace has **no payment method**; the plan is Hobby; the instance type reads **Free**.
- [ ] No other paid resource is attached (no disk, no custom-domain upgrade, no paid workspace plan).
- [ ] Auto-Deploy is **Off** and the build filter is set, so unrelated pushes spend no pipeline minutes.
- [ ] Teardown is known: Settings → Delete Web Service; then remove the two Vercel env vars.
- [ ] The vendor checklist in [`vendors.md`](../../stack/vendors.md#adding-new-vendors) is done before going live (GDPR page, DPA, `gdpr.md` row). The service receives only synthetic order events and stores nothing, but Render still sees request metadata (IPs of Vercel's functions, timing).

### Security checklist

- [ ] The token is new, 32+ random bytes, used for this target only, stored only in Render and Vercel (never in the repo or a chat).
- [ ] `EXTERNAL_SERVICE_REMOTE_URL` is `https://` and an origin only; the lab shows the target as *Configured*.
- [ ] `curl https://<service>.onrender.com/v1/status` without the token → `401`; `/health/live` → `{"status":"live"}` only.
- [ ] Render's logs show one JSON line per request with no `authorization` value.

### Hosted verification (the evidence that promotes the remote half)

1. Leave the service idle for 20+ minutes, then run `EXTERNAL_SERVICE_REMOTE_URL=… EXTERNAL_SERVICE_REMOTE_TOKEN=… bun run external-service:verify -- --target remote --samples 50`. The first call measures the cold start; `uptimeMs` confirms the run woke the process.
2. All negative paths must pass (401, 400, 413, adapter refusal, rule refusal, spent deadline).
3. On the deployed v10r, open `/showcases/external-service`, check the **Remote host** card twice (cold, then warm), run a scenario and each drill.
4. Record the figures and conditions in [Measurement](#measurement), then update the pattern record (`architecture-external-service`) — its remote verification is **pending** until this is done.

## Measurement

What each figure is, and where it comes from — no figure here is estimated:

| Figure | Source |
|---|---|
| Service processing | the service's own `Server-Timing: app;dur=` — handler + middleware, inside the process |
| HTTP round trip | adapter: fetch start → response body read |
| Adapter overhead | adapter total − round trip: request/response validation, parsing |
| Cold start | the first call after idle; `uptimeMs` < the check's own duration ⇒ this call started the process |
| Failure detection | time from call start to a classified failure |

**Local, 2026-10-22** — `verify.ts` against the container, cloud sandbox (Linux, 4 vCPU, Docker 29.9 rootful, loopback), Bun 1.3.12, warm process, 200 sequential `evaluate` calls:

| | p50 | p95 | max |
|---|---|---|---|
| HTTP round trip | 0.74 ms | 2.49 ms | 4.49 ms |
| Service processing (`app`) | 0.03 ms | 0.06 ms | 0.08 ms |
| Adapter overhead | 0.12 ms | 0.30 ms | 2.04 ms |
| Adapter total | 0.88 ms | 2.88 ms | 4.69 ms |

Failure detection, same run: connection refused → `unreachable` in 34 ms (two attempts with jittered backoff); spent deadline → `timed_out` in 0.14 ms (nothing sent); a stopped container → `unreachable` in 23 ms. A **1 ms** budget lost the race to the warm local service 19 times in 20 — which is why the lab's deadline drill uses a spent budget rather than a tiny one. Container start → first liveness answer: 318–352 ms (3 runs, image present). Image: 11.7 MB compressed, 46.4 MB unpacked. Build: 33 s with base images cached, 8 s for a source-only rebuild (dependency layer cached).

**Remote: pending** — not deployed; see [Hosted verification](#hosted-verification-the-evidence-that-promotes-the-remote-half).

What these numbers do **not** say: that Rust is faster. The evaluation is microseconds in any language; the boundary costs ~0.7 ms on loopback and will cost tens of milliseconds across a network, before any cold start. A service boundary is paid for in latency and operations — it is worth it for isolation, ownership or a runtime the app cannot host, not for speed of a small computation.

## Rejected alternatives

- **The browser calling the service directly (CORS).** Puts the credential or a public endpoint in reach of every visitor; the server-side adapter makes the boundary private and lets one deadline govern the whole request.
- **A generic proxy route.** A caller-supplied URL or path is an SSRF primitive; targets are named, paths fixed.
- **A Rust toolchain in the app container.** The wasm precedent: the dev container stays Rust-free and `validate` never needs cargo; the manifest carries the evidence across.
- **One Cargo workspace with `crates/kernel`.** Different deploy units, lockfiles and release cadences; a workspace would couple them for no gain.
- **A hand-written spec, `aide`, `progenitor`.** A hand-written spec is a second source of truth; `aide` (schemars) is a peer of utoipa with less axum integration; `progenitor` generates a Rust *client*, the wrong direction.
- **`openapi-fetch` or a generated runtime client.** The adapter needs its own deadline, bounded read, classification and timing anyway; a runtime client would be a second layer around the same `fetch`.
- **ajv/zod for runtime validation.** valibot is already the repo's validator; the mirrors are pinned to the generated types instead.
- **RFC 9457 `problem+json`.** A fine standard, but v10r's envelope is `{ error: { code, message } }`; one convention beats two.
- **`tracing`/OpenTelemetry in the service.** One JSON line per request and `Server-Timing` cover this service; the `latency-tracing` record names OpenTelemetry as the upgrade when spans must cross processes.
- **A breaker around the call.** `resilience-policy` has one (`defineBreaker`); here it would fight cold starts — a waking free host fails the first calls by design, and an open breaker would keep refusing after it woke. Add one for a service that is expected to be always-on.
- **Fault-injection endpoints or flags in the service.** Anything that can make a service fail on purpose can be reached by mistake. Drills change only what the caller sends.
- **A database or any persistent state in the service.** Out of scope for the reference; it would make it a different pattern.

## Emulating this pattern

Take the boundary, not v10r: none of this needs the rest of the repository.

1. Put the service in its own directory with its own lockfile, toolchain pin and container definition; build context = that directory.
2. Make the service's wire types the authority and **generate** the spec from them; snapshot-test the spec, and test it against your serializer's real behaviour in both directions.
3. Generate client types from the spec; add a runtime validator pinned to those types; prove the drift check with deliberately broken specs.
4. One server-only adapter: fixed targets from server config, origin-only URLs, https off-box, a deadline per call, a bounded body read, one failure kind per cause, retries only for idempotent operations on "nothing answered", no redirects, a request id, and the service's own timing header.
5. The service authenticates every functional route itself, refuses to start without a credential, keeps liveness public and empty, bounds its input, and logs one line per request with no headers or bodies.
6. Keep the service optional in code: one importer, configuration read per call, no network work on page load.
7. Ship one image to every host; let the host set only the port and the secret.
