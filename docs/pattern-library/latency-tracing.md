---
title: "Latency tracing (a v10r span API, Server-Timing as one renderer)"
description: "Every layer records spans into a request-scoped recorder stamped by the outermost handler; `Server-Timing` renders them for callers who already see internals…"
category: "Velocity Measurement"
---

# Latency tracing (a v10r span API, Server-Timing as one renderer)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Velocity Measurement · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — it sits on every request, and the header is client-readable

Every layer records spans into a request-scoped recorder stamped by the outermost handler; `Server-Timing` renders them for callers who already see internals, and `unattributed` reports the wall-clock time no span claimed.

**When to use:** Use anywhere performance matters and a slow response needs to decompose — the request lifecycle, domain operations, databases, caches, external services.

## Docs

- [docs/blueprint/velocity/measurement.md#latency-tracing](/docs/blueprint/velocity/measurement) — Why unattributed is a floor, not a figure ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/measurement.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/measurement.md))

## Code

- `src/lib/server/http/request-timing.ts` — The span API domain code records into ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/request-timing.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/request-timing.ts))
- `src/hooks.server.ts` — requestTiming, outermost so `total` is the whole request ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/hooks.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/hooks.server.ts))

## Tests

- `src/lib/server/http/request-timing.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/request-timing.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/request-timing.test.ts))
- `src/lib/server/security/handle-chain.gate.test.ts` — Pins the tracer outermost and the IP stamp above everything that consumes it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/handle-chain.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/handle-chain.gate.test.ts))

## Proof

- [`/showcases/observability/overview`](/showcases/observability/overview)

## Invariants

- Instrumentation does not materially damage performance — a span is one clock pair and one push, and the span list is capped so instrumenting inside a loop degrades to silence rather than to unbounded memory.
- `unattributed` is a FLOOR, not a figure: concurrent spans overlap, so their durations can sum past the wall clock and the value clamps at zero. A zero means 'spans covered it', never 'nothing was missed'.
- Full span detail is disclosure — it maps internal architecture and hands out a timing oracle — so it goes only to callers who already see internals.
- Span names are sanitized to header tokens; a raw name would inject a delimiter and corrupt every field after it.
- Coverage is stated, not implied: prerendered routes never reach the handler on a CDN-served deployment.

## Emulation notes

- Own the tracing API and put the vendor behind it. Domain code depends on the shape, so swapping `Server-Timing` for an OpenTelemetry exporter is one adapter, not a migration — and no dependency is needed to start.
- The tracer must be the OUTERMOST middleware or `total` measures a subset, and every 'unattributed' figure derived from it is understated. Where a security handler must be first for its own reasons, prove the ordering in a gate rather than arguing it in a comment.
- Round durations coarsely. Finer resolution is noise at request scale and a sharper clock is a sharper side channel.

---

_Machine-readable record: `latency-tracing` in `pattern-library/registry.json`._
