---
title: "Generative UI"
description: "The model composes interfaces as A2UI v1.0 data from a closed catalog the application defines; a policy and the official validator refuse anything outside it…"
category: "AI"
---

# Generative UI

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** deep · **Maturity:** implemented · **Risk:** medium — fresh 0.x core that breaks often; pinned exactly and gated

The model composes interfaces as A2UI v1.0 data from a closed catalog the application defines; a policy and the official validator refuse anything outside it; a lazy Svelte 5 adapter over the lit-free core of @a2ui/web_core renders it with the app's own components and tokens, binds inputs locally and emits bounded view-risk actions. The catalog has a general section (layout, text, notices, disclosure, form fields with bound errors, a data-table bar chart, progress) and a domain section a derived app replaces. Each press carries an event id and a submission key, and is admitted once against the persisted conversation by a claimed row id, so a retry or double click starts no second turn. The human-facing record stays separate from the model prompt. A2UI Express is the model-output language (about 40 % fewer tokens than A2UI JSON, measured).

**When to use:** Use when the shape of an answer depends on the question and must be interactive — forms for missing inputs, comparisons, choices, updates to what is on screen.

**Needs:** required llm-provider, relational-db (via deskbot-approval-gate, durable-step-execution)

## Avoid when

- The shape is known in advance — a fixed card fed structured data is cheaper and needs no catalog prompt
- The interface must persist data on its own — surfaces only emit events

## Alternatives

- **json-render with its official Svelte renderer** — prefer when bundle size dominates and no A2UI interop is needed
- **MCP Apps (sandboxed HTML)** — prefer when the view is a full application a third party ships

## Docs

- [docs/blueprint/ai/generative-ui.md](/docs/blueprint/ai/generative-ui) — Roles, catalog sections, measured comparison, security model, dedup rules, evaluation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/generative-ui.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/generative-ui.md))

## Code

- `src/lib/generative-ui//` — Catalog (general + domain sections), limits, policy, surface action record and submission key ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/generative-ui/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/generative-ui/))
- `src/lib/components/composites/generative-surface//` — Lazy Svelte renderer ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/generative-surface/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/generative-surface/))
- `src/lib/server/ai/generative-ui//` — Express compiler, prompt, render_surface tool, surface history, surface action door ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/ai/generative-ui/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/ai/generative-ui/))

## Tests

- `src/lib/generative-ui/generative-ui.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/generative-ui/generative-ui.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/generative-ui/generative-ui.gate.test.ts))
- `src/lib/generative-ui/policy.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/generative-ui/policy.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/generative-ui/policy.test.ts))
- `src/lib/components/composites/generative-surface/surface-session.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/generative-surface/surface-session.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/generative-surface/surface-session.svelte.test.ts))
- `src/lib/server/ai/generative-ui/compile-surface.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/generative-ui/compile-surface.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/generative-ui/compile-surface.test.ts))
- `src/lib/server/ai/generative-ui/surface-action-door.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/generative-ui/surface-action-door.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/generative-ui/surface-action-door.test.ts))
- `src/lib/server/ai/generative-ui/surface-conversation.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/generative-ui/surface-conversation.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/generative-ui/surface-conversation.test.ts))

## Proof

- [`/showcases/interop`](/showcases/interop) — Agentic Interoperability Lab — each section labels itself live, fixture or recorded

## Invariants

- A surface is data rendered by the app's own components: no HTML injection, no script URLs, no catalog functions.
- Every batch passes the policy (size, depth, cycles, bindings, catalog) before the protocol core sees it.
- A surface action is a bounded view-risk event; a button press is never an approval.
- A press is admitted once: the same event id or the same submission key against the persisted conversation is refused, and the admitted row's id is claimed atomically.
- What the user sees for a press and what the model reads are separate: the persisted row keeps the human record, the model gets the event as wrapped untrusted content.
- The renderer never imports Lit or the protocol's own web-component catalog, and loads only when a surface is shown.

## Emulation notes

- Build your own catalog over your components; the protocol's basic catalog module pulls in a web-component framework at import time.
- Measure the catalog prompt, not only the payload: it is the larger token cost.
- Keep the general section and replace the domain section with your product's own components; give every chart a text alternative by drawing it as data.

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Component-first UI system](/docs/pattern-library/component-system) — The closed catalogue renders through the app's own components and tokens; any component library with a closed catalogue satisfies it.
- [Untrusted-content boundary](/docs/pattern-library/untrusted-content-boundary) — Model-composed surfaces are untrusted data: policy and validator refuse anything outside the catalogue.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Agentic architecture](/docs/pattern-library/agentic-architecture) (conditional)


---

_Machine-readable record: `generative-ui` in `pattern-library/registry.json`._
