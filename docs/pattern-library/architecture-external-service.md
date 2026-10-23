---
title: "External service runtime (a separately deployed backend behind a typed client)"
description: "A separately deployed service — reference: the Rust/Axum runtime lab, an order-rules engine, in its own OCI container — is reached only through one…"
category: "Architecture & Request Pipeline"
---

# External service runtime (a separately deployed backend behind a typed client)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-10-22 @ f274c25) · **Risk:** medium — a second deployable with its own credential, uptime and cost surface; the static bearer is shared and replayable (rotation without downtime is supported); running on Render Free (Frankfurt) and verified end to end from production, where a sleeping service misses the normal 8 s budget (the wake check exists for it); cold-start duration, warm hosted percentiles and Render's proxy behaviour at the 5 s idle close are not yet measured

A separately deployed service — reference: the Rust/Axum runtime lab, an order-rules engine, in its own OCI container — is reached only through one server-only service client: a code-generated OpenAPI contract with generated TS types and drift-checked runtime mirrors, service-enforced bearer auth, request deadlines, one failure kind per cause, request ids and a Server-Timing split. Hardened by measurement: non-blocking stdout logging, SERVICE_TOKEN_PREVIOUS rotation, a 16 KiB head cap, a contract release record with skew diagnosis, cargo-deny, and a 0.1 CPU benchmark profile. Verified locally (container, real client, showcase, controlled lab) and in production on Render Free Frankfurt (end to end, failure paths measured); hosted cold-start and warm percentiles are still unmeasured.

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
- [docs/blueprint/architecture/external-service.md#evolving-the-contract](/docs/blueprint/architecture/external-service) — Release names the contract, append-only release record, expand/contract deploy order, contract skew as a diagnosis ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))
- [docs/blueprint/architecture/external-service.md#logging-never-stops-the-service](/docs/blueprint/architecture/external-service) — Why println! is a dependency on the log reader, and the measured no-wake, timed-drain writer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))
- [docs/blueprint/architecture/external-service.md#rotating-the-credential](/docs/blueprint/architecture/external-service) — Zero-downtime bearer rotation with SERVICE_TOKEN_PREVIOUS (the key ring's _PREVIOUS convention), OWASP API Top 10 mapping, when to move to OIDC ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))
- [docs/blueprint/architecture/external-service.md#hosting-on-render](/docs/blueprint/architecture/external-service) — Exact Render Free setup (deployed 2026-10-23), cost and security checklists, hosted-verification steps and production figures ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/external-service.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/external-service.md))

## Code

- `services/runtime-lab/` — The reference service: own lockfile, toolchain pin, Containerfile, render.yaml ([GitHub](https://github.com/ApeDevil/v10r/tree/main/services/runtime-lab) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/services/runtime-lab))
- `services/runtime-lab/src/order.rs` — The service's domain — pure order-lifecycle rules, no HTTP ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/order.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/order.rs))
- `services/runtime-lab/src/contract.rs` — Wire types + OpenAPI document — the API's single authority ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/contract.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/contract.rs))
- `services/runtime-lab/src/http.rs` — Bearer auth (current + previous credential, both compared), body limit, request timeout, request id, Server-Timing, access log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/http.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/http.rs))
- `services/runtime-lab/src/main.rs` — Accept loop: header-read timeout, 16 KiB head cap, connection cap, graceful drain, worker count logged ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/main.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/main.rs))
- `services/runtime-lab/src/log.rs` — The one log writer: bounded buffer, never blocks or wakes on the request path, drop-and-count, bounded exit flush ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/log.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/log.rs))
- `services/runtime-lab/src/config.rs` — Fail-closed credential and bind configuration; optional SERVICE_TOKEN_PREVIOUS held to the same rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/config.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/config.rs))
- `services/runtime-lab/contract-releases.json` — Append-only release → contract digest record; a patch never changes the contract ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/contract-releases.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/contract-releases.json))
- `services/runtime-lab/deny.toml` — cargo-deny policy: advisories, license allowlist, crates.io-only sources ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/deny.toml) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/deny.toml))
- `services/runtime-lab/openapi.json` — The generated contract, committed ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/openapi.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/openapi.json))
- `services/runtime-lab/Containerfile` — One distroless nonroot image for Podman and Render ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/Containerfile) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/Containerfile))
- `src/lib/server/showcases/external-service/client.ts` — callService — deadline, bounded read, validation, classification, retry policy ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/client.ts))
- `src/lib/server/showcases/external-service/contract.ts` — valibot mirrors pinned to the generated types + contractDrift() ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract.ts))
- `src/lib/server/showcases/external-service/contract-skew.ts` — contractSkew(): a running service's release against CONTRACT_RELEASE — a diagnosis, never a gate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract-skew.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract-skew.ts))
- `src/lib/server/showcases/external-service/targets.ts` — Server-fixed targets: origin-only URLs, TLS off private hosts, credential rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/targets.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/targets.ts))
- `src/lib/server/showcases/external-service/targets.adapter.ts` — The one environment read ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/targets.adapter.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/targets.adapter.ts))
- `src/lib/showcases/external-service/types.ts` — Page-safe vocabulary and the public projection of a call ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/external-service/types.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/external-service/types.ts))
- `scripts/external-service/generate-contract.ts` — openapi.json → TypeScript types and CONTRACT_RELEASE; appends to the release record (canonical contract digest), refusing a release that breaks the rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/generate-contract.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/generate-contract.ts))
- `scripts/external-service/check.sh` — Rust gate + freshness manifest, outside validate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/check.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/check.sh))

## Tests

- `src/lib/server/showcases/external-service/client.test.ts` — Service client over a real socket: every failure kind, retry policy, request ids, no secrets in results or logs ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/client.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/client.test.ts))
- `src/lib/server/showcases/external-service/contract.test.ts` — Mirrors match openapi.json; 14 breaking mutations detected at the right path; operation table pinned to paths ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract.test.ts))
- `src/lib/server/showcases/external-service/contract-freshness.test.ts` — Generated types and check-manifest current; release record consistent (and its two failure cases caught); stamped checks = check.sh's; one Rust builder pin ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract-freshness.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract-freshness.test.ts))
- `src/lib/server/showcases/external-service/contract-skew.test.ts` — Skew across patch, minor, major and 0.x releases, directional for additive changes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/contract-skew.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/contract-skew.test.ts))
- `src/lib/server/showcases/external-service/config.test.ts` — The lab's limiter policies against a slow, failing and absent limiter store ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/config.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/config.test.ts))
- `services/runtime-lab/src/log.rs` — Rust tests: a blocking writer never blocks emit and every loss is counted; a failing writer never panics; order kept ([GitHub](https://github.com/ApeDevil/v10r/blob/main/services/runtime-lab/src/log.rs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/services/runtime-lab/src/log.rs))
- `tests/browser/external-service.spec.ts` — A platform error page and a failed fetch are reported, spinner cleared, history kept (Playwright; not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/tests/browser/external-service.spec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/tests/browser/external-service.spec.ts))
- `src/lib/server/showcases/external-service/isolation.gate.test.ts` — Only the showcase imports the client; env names in one module ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/isolation.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/isolation.gate.test.ts))
- `src/lib/server/showcases/external-service/targets.test.ts` — Target rules: origins, TLS off private hosts, credential format ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/showcases/external-service/targets.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/showcases/external-service/targets.test.ts))
- `scripts/external-service/smoke.sh` — Container lifecycle over a real socket, read-only and capability-free: auth incl. rotation, bounds incl. 431, slowloris, SIGTERM (not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/smoke.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/smoke.sh))
- `scripts/external-service/verify.ts` — Real client against a running service: skew, negative paths, presets, lanes, idle gaps, measurements — run locally and under bench.sh; the hosted run is still to record (not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/verify.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/verify.ts))
- `scripts/external-service/bench.sh` — The image under the free-tier envelope (--cpus 0.1 --memory 512m) — controlled-lab figures (not in validate) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/bench.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/bench.sh))
- `scripts/external-service/audit.sh` — cargo-deny against deny.toml (needs the network; not in validate, like bun run audit) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/external-service/audit.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/external-service/audit.sh))

## Proof

- [`/showcases/external-service`](/showcases/external-service)

## Invariants

- The browser never calls the service: pages post ids from closed lists (target, preset, drill, patience) and the server owns every URL, credential and request body — no proxy, no CORS
- The service's wire types are the contract's only authority: openapi.json is generated from them, tested against the serializer's real behaviour in both directions, and the TS types are generated from it
- Runtime validation mirrors are pinned to the generated types at compile time and compared with the spec at test time — every modelled keyword, unknown keywords reported; the client's operation table is pinned to the spec's paths; requests validate closed, responses open
- Functional routes require the bearer credential checked by the service itself, in constant time; the service refuses to start without a printable credential of at least 32 characters; liveness is public, gets no credential, and says only 'live'
- Every call runs inside the request deadline with a bounded response read and ends in exactly one failure kind; only operations declared idempotent are retried, once, and only when no response arrived
- The service bounds what callers can make it hold: request heads must complete in 5 s (idle connections close too) and stay under 16 KiB, connections are capped, and anything it logs from a request is clipped by characters
- Logging never holds up the request path: each line is appended to a bounded buffer it never waits on or wakes, a full buffer drops and counts, and shutdown waits for logs at most 1 s
- A credential rotates without a refusal window: the service also accepts SERVICE_TOKEN_PREVIOUS, held to the same rules and never equal to the current one, compared on every request
- A release names its contract: a contract change without a version bump, or a patch release that changes the contract, is refused by the gate; skew between the running service and the app is reported as a diagnosis only
- Credentials and origins appear in no result, log line or error message; the environment is read in one server-only module; plain http carries the credential only to private hosts
- The service is optional: one importer, configuration resolved per call, no network work on page load; neither the service nor the client has fault-injection switches

## Emulation notes

- Give the service its own directory, lockfile, toolchain pin and container definition, and build with that directory as the context — not the repository root.
- In a product the service client is a domain named for the service (client, contract, targets, targets.adapter, config); v10r's lab.ts and presets.ts are demo code — do not copy them.
- Generate the spec from the service's types and snapshot it; then test the spec against the serializer in both directions — schema generators read attributes, not behaviour (utoipa ignored serde's rename_all_fields and left tagged-enum variants open here).
- Prove the drift check by breaking the spec on purpose and asserting where the drift is reported; make it fail on keywords it does not model — a check that silently skips what it cannot read lets the novel break through.
- Keep Rust out of the JS gate with a freshness manifest written only when fmt, clippy and tests pass, from hashes taken before they ran, covering the check script itself.
- Truncate anything caller-controlled by characters, never bytes, and give the server a header-read timeout — both were real holes in the first version of this service.
- Measure the boundary three ways — round trip, the service's own Server-Timing, client overhead — and read the process uptime to recognise a cold start; never claim a language is faster from these numbers.
- A breaker fights a free host's cold start (it keeps refusing after the host wakes); add one only for an always-on service.
- The log reader is a dependency: println! blocks a worker on a full pipe and panics on a closed one. Write through a bounded buffer one thread drains — and on a fractional CPU do not wake that thread per line: measured at 0.1 CPU, the wake-up cost a fifth of throughput, a 20 ms timed drain beat println! itself.
- Measure under the host's envelope (a cgroup CPU quota and memory limit), not only on a workstation: Tokio sized itself to the quota (1 worker) and throttling, not the service, set the tail.
- Release-profile tuning (LTO, codegen-units=1, panic=abort) bought 7 µs per call and cost twice the build minutes here; panic=abort would turn a handler panic into a crash. Leave it unless the service is CPU-bound.
- Additive is directional: with responses read open, deploy the service before the app that relies on what it adds; expand, migrate, contract for anything that removes. Response enum values are the exception: a reader that validates them strictly turns a new value into a breaking change.
- Hash the contract, not the document: drop prose and sort keys before digesting, or every doc-comment edit and generator upgrade reads as a contract change.
- Give the costliest public action its own, smaller rate-limit buckets: here a wake check holds a function and the free host for up to 75 s.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)
- [Deadline propagation (one budget, divided)](/docs/pattern-library/deadline-propagation)
- [Resilience policy (breaker, bulkhead, shedding, bounded retry)](/docs/pattern-library/resilience-policy)
- [Latency tracing (a v10r span API, Server-Timing as one renderer)](/docs/pattern-library/latency-tracing)

---

_Machine-readable record: `architecture-external-service` in `pattern-library/registry.json`._
