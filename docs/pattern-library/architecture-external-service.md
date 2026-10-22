---
title: "External service runtime (a separately deployed backend behind a typed adapter)"
description: "A separately deployed service — reference: Rust/Axum order-rules in its own OCI container — is reached only through one server-only adapter: a code-generated…"
category: "Architecture & Request Pipeline"
---

# External service runtime (a separately deployed backend behind a typed adapter)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-10-22 @ 3901d6d) · **Risk:** medium — a second deployable with its own credential, uptime and cost surface; the static bearer is shared and replayable until rotated; hosted behaviour (Render Free, ~1 min cold starts) is documented but not yet verified

A separately deployed service — reference: Rust/Axum order-rules in its own OCI container — is reached only through one server-only adapter: a code-generated OpenAPI contract with generated TS types and drift-checked runtime mirrors, service-enforced bearer auth, request deadlines, one failure kind per cause, request ids and a Server-Timing split. Verified locally (container, real adapter, showcase); hosted Render verification is pending.

**When to use:** Use when one responsibility needs its own runtime, release cadence or resource profile — a CPU-heavy engine, a component another product also calls, a language-specific library — and the app must keep working when that process is down.

**Requires:** container-host

## Avoid when

- The work fits a $lib/server/[domain]/ module — a second deployable doubles what can be down, drift or leak
- The motive is the speed of a small computation — the boundary costs ~1 ms on loopback and tens of ms across a network, before any cold start
- The browser must call the service directly — that puts the credential or an open endpoint within every visitor's reach

## Alternatives

- **A framework-free domain module inside the app (multi-client-core)** — prefer when the work runs fine in the app's own runtime and has no separate release, scaling or ownership need
- **Rust compiled to wasm and run in the browser (architecture-wasm-kernel)** — prefer when the work is compute-dense over the user's own data and needs no secret, server state or second host
- **OIDC workload identity (e.g. Vercel OIDC tokens verified against JWKS) or HMAC request signing instead of a static bearer** — prefer when the caller credential must not be a shared static secret, or requests must resist replay

## Docs

- [docs/blueprint/architecture/external-service.md](/docs/blueprint/architecture/external-service) — The pattern: contract chain, adapter guarantees, security model, failure model, container, measurements ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))
- [docs/blueprint/architecture/external-service.md#hosting-on-render-prepared-not-deployed](/docs/blueprint/architecture/external-service) — Exact Render Free setup, cost and security checklists, hosted-verification steps (pending) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))

## Code

- `services/order-rules/` — The reference service: own lockfile, toolchain pin, Containerfile ([GitHub](https://github.com/ApeDevil/v10r/tree/main/services/order-rules) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/services/order-rules))
- `services/order-rules/src/contract.rs` — Wire types + OpenAPI document — the API's single authority ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/order-rules/src/contract.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/order-rules/src/contract.rs))
- `services/order-rules/src/http.rs` — Bearer auth, body limit, timeout, request id, Server-Timing, access log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/order-rules/src/http.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/order-rules/src/http.rs))
- `services/order-rules/Containerfile` — One distroless nonroot image for Podman and Render ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/order-rules/Containerfile) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/order-rules/Containerfile))
- `src/lib/server/showcases/external-service/client.ts` — callService — deadline, bounded read, validation, classification, retry policy ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/client.ts))
- `src/lib/server/showcases/external-service/contract.ts` — valibot mirrors pinned to the generated types + contractDrift() ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract.ts))
- `src/lib/server/showcases/external-service/targets.ts` — Server-fixed targets: origin-only URLs, https off-box, credential floor ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/targets.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/targets.ts))

## Tests

- `src/lib/server/showcases/external-service/client.test.ts` — Adapter over a real socket: every failure kind, retry policy, no secrets in results or logs ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/client.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/client.test.ts))
- `src/lib/server/showcases/external-service/contract.test.ts` — Mirrors match openapi.json; nine breaking spec mutations are all detected ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract.test.ts))
- `src/lib/server/showcases/external-service/contract-freshness.test.ts` — Generated types and check-manifest current; one Rust builder pin ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract-freshness.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract-freshness.test.ts))
- `src/lib/server/showcases/external-service/isolation.gate.test.ts` — Only the showcase imports the adapter; env names in one module ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/isolation.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/isolation.gate.test.ts))
- `scripts/external-service/smoke.sh` — Container lifecycle over a real socket (not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/smoke.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/smoke.sh))
- `scripts/external-service/verify.ts` — Real adapter against a running service, with measurements — local and hosted (not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/verify.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/verify.ts))

## Proof

- [`/showcases/external-service`](/showcases/external-service)

## Invariants

- The browser never calls the service: pages post ids from closed lists (target, scenario, drill) and the server owns every URL, credential and request body — no proxy, no CORS
- The service's wire types are the contract's only authority: openapi.json is generated from them, tested against the serializer's real behaviour in both directions, and the TS types are generated from it
- Runtime validation mirrors are pinned to the generated types at compile time and compared with the spec at test time; requests validate closed, responses open (additive change stays compatible)
- Functional routes require the bearer credential checked by the service itself, in constant time; the service refuses to start without one of at least 32 characters; liveness is public and says only 'live'
- Every call runs inside the request deadline with a bounded response read and ends in exactly one failure kind; only operations declared idempotent are retried, once, and only when nothing answered
- Credentials and origins appear in no result, log line or error message; the environment is read in one server-only module
- The service is optional: one importer, configuration resolved per call, no network work on page load

## Emulation notes

- Give the service its own directory, lockfile, toolchain pin and container definition, and build with that directory as the context — not the repository root.
- Generate the spec from the service's types and snapshot it; then test the spec against the serializer in both directions — schema generators read attributes, not behaviour (utoipa ignored serde's rename_all_fields and left tagged-enum variants open here).
- Prove the drift check by breaking the spec on purpose (removed field, renamed enum value, new required field, tightened bound); a check that has never failed proves nothing.
- Keep Rust out of the JS gate with a freshness manifest written only when fmt, clippy and tests pass — the same method as a vendored build artifact.
- Measure the boundary three ways — round trip, the service's own Server-Timing, adapter overhead — and read the process uptime to recognise a cold start; never claim a language is faster from these numbers.
- A breaker fights a free host's cold start (it keeps refusing after the host wakes); add one only for an always-on service.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)
- [Deadline propagation (one budget, divided)](/docs/pattern-library/deadline-propagation)
- [Resilience policy (breaker, bulkhead, shedding, bounded retry)](/docs/pattern-library/resilience-policy)
- [Latency tracing (a v10r span API, Server-Timing as one renderer)](/docs/pattern-library/latency-tracing)

---

_Machine-readable record: `architecture-external-service` in `pattern-library/registry.json`._
