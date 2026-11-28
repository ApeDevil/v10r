# Multi-client core

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

One backend operations layer (#lib/server/[domain]/) serves four clients — human UI, AI tools, REST API, background jobs — via thin wrappers, with zero duplicated business logic.

**When to use:** Reach for this whenever a backend capability must be reachable from more than one entry point (page action, API route, AI tool, cron job). It is the foundation nearly every other v10r pattern builds on.

**Needs:** v10r's implementation uses llm-provider, relational-db

## Avoid when

- An operation with one consumer that is a single data call — the extraction rules keep it in the route, unwrapped
- Extracting a domain service for a hypothetical second client — extract only when two concrete consumers share a multi-step workflow
- Reaching for DI containers, command buses or one-implementation interfaces — the pattern is plain module imports, not hexagonal ceremony

## Alternatives

- **Call the data function directly from the +page.server.ts or +server.ts adapter** — prefer when the operation is one query or mutation with a single concrete consumer
- **Class-based DI containers with formal port interfaces** — prefer when the runtime is a long-lived server with no serverless cold-start cost and a port has more than one real implementation

## Docs

- `docs/blueprint/architecture/multi-client-core.md` — The full pattern: canonical module shape, client wiring, error contract ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/multi-client-core.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/multi-client-core.md))
- `docs/system-abstraction.md` — Runtime 7-layer view showing where domain modules sit ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/system-abstraction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/system-abstraction.md))
- `docs/codebase-organization.md` — Where each piece lives; import direction rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/codebase-organization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/codebase-organization.md))

## Code

- `src/lib/server/` — Per-domain modules; canonical shape is [domain]/queries.ts + mutations.ts (+ service.ts only when orchestration spans multiple infra calls) ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server))
- `src/hooks.server.ts` — Runtime layers and request flow — Documents v10r's seven-layer abstraction hierarchy, from tech stack down to code, anchored by the hooks.server.ts composition root and the hexagonal domain core. Reach for it when orienting a new contributor or agent to how a request moves through the system and which layer a given file belongs to. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/hooks.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/hooks.server.ts))
- `src/` — Codebase map — Provides a spatial quick-reference table mapping each kind of code (business logic, route adapters, schemas, components, state) to its canonical directory. Reach for it when deciding where a new file should live or trying to locate an existing concern in the repo. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src))
- `src/lib/server/showcases/cycle/` — Request-cycle visualizer — An interactive showcase that visualizes the full form, REST API, and AI request cycles as they pass through the hooks chain and domain layers. Reach for it when you need a live, didactic demonstration of how a form submission, API call, or AI request actually traverses the stack. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/showcases/cycle) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/showcases/cycle))
- `src/lib/components/showcases/cycle/` — Request-cycle visualizer ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/showcases/cycle) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/showcases/cycle))

## Tests

- `src/lib/server/security/handle-chain.gate.test.ts` — Middleware-order contract of the multi-client wiring; validate gate — runs on every bun run validate; pins the middleware order the layer model describes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/handle-chain.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/handle-chain.gate.test.ts))
- `src/lib/api.gate.test.ts` — Adapter-boundary gate: client code reaches /api only through apiFetch ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/api.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/api.gate.test.ts))

## Proof

- [`/showcases/cycle/form`](https://www.v10r.dev/showcases/cycle/form) — Request-cycle visualizer
- [`/showcases/cycle/api`](https://www.v10r.dev/showcases/cycle/api) — Request-cycle visualizer
- [`/showcases/cycle/ai`](https://www.v10r.dev/showcases/cycle/ai) — Request-cycle visualizer

## Invariants

- Domain functions must not import from @sveltejs/kit or $app/ — binding to the request cycle breaks tool and job reuse.
- AI tools RETURN structured errors — never throw.
- The tool manifest is fail-closed: if a tool is not in the manifest, the AI cannot call it; AI tools get a narrower permission set than the human UI.
- Tools capture userId by closure — a tool never sees an unauthenticated call.

## Emulation notes

- Start every new project with this shape even if only one client exists yet — the second client (AI tool or cron) always arrives.
- Keep adapters thin: a +page.server.ts action or +server.ts route should validate input, call one domain function, map the result.

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/design-philosophy.md) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](component-system.md) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `multi-client-core` in `pattern-library/registry.json`._
