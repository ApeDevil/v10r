# Generative UI — A2UI surfaces rendered with v10r's own components

**Maturity: wired, not live-evaluated.** Catalog, validator, server compiler, lazy Svelte
renderer, fixtures and benchmark exist on `claude/cloud/agentic-architecture`, and the
chatbot mounts `render_surface` (below). No live model has been evaluated — the cloud session
has no provider key; the eval cases are written and run locally with `bun run ai:eval`. Supersedes the 2026-11-23 A2UI research's
"gated spike" recommendation; its stop condition was tested and not triggered.

## Problem

The assistant answers in text plus fixed cards. When the shape of the answer depends on the
question — collect three missing requirements, compare four technologies, offer two
architectures to choose from, update a form that is already on screen — each shape needs new
card code. Letting the model write HTML or Svelte is unacceptable (code execution, an
injection channel, no design-system guarantee).

## Decision

A2UI ("safe like data, expressive like code"): the model emits a declarative description of a
UI, limited to a **catalog** of components v10r defines and renders with `#lib/components`.

| Role | Choice | Where |
|---|---|---|
| Model-output language | A2UI **Express** (compact), compiled to v1.0 messages by the official `@a2ui/agent` | `src/lib/server/ai/generative-ui/compile-surface.ts`, `surface-prompt.ts` |
| Catalog | 18 closed JSON-Schema components in two sections (one catalog id) — see [Catalog](#catalog) | `src/lib/generative-ui/catalog.ts` |
| Policy | Limits and refusals checked before the official validator | `src/lib/generative-ui/policy.ts`, `limits.ts` |
| Renderer | Svelte 5 adapter over the **lit-free root** of `@a2ui/web_core` (MessageProcessor, data model, signals) | `src/lib/components/composites/generative-surface/` |
| Entry | `LazyGenerativeSurface.svelte` — dynamic import, so web_core loads only when a surface is shown | same |
| Action | `GenerativeSurfaceAction` — bounded, `view` risk; an event, never an execution | `src/lib/generative-ui/surface-action.ts` |
| Interop protocol | A2UI v1.0 (rideable over MCP, A2A or AG-UI) | — |

## Catalog

One catalog id (`GENERATIVE_UI_CATALOG_ID`), two sections. The **general** section is
what any v10r-derived app needs; the **domain** section is components that only make sense
for this product, and is the one a derived project replaces. The split is a list
(`GENERATIVE_UI_GENERAL_COMPONENTS`, `GENERATIVE_UI_DOMAIN_COMPONENTS`) that the prompt, the
bench and the tests read, not a second protocol catalog.

| Section | Component | Renders with | Bounds / policy | Accessibility |
|---|---|---|---|---|
| general | Column, Row, Card, Heading, Text, Badge, Divider | layout primitives, `Card`, `Badge` | children ≤ 40, strings ≤ 1,000 | semantic heading levels; text as text |
| general | **Expandable** `{title, child, open?}` | `Accordion` | one child; counted in the node budget | the `Accordion` primitive's disclosure semantics |
| general | **Notice** `{text, tone?, title?}` | `Alert` composite | tone ∈ info/success/warning/error | the Alert's role; a notice with no text and no title renders nothing (a slot for later feedback) |
| general | TextField `{…, error?}` | `FormField` + `Input`/`Textarea` | **error** is a string or a binding | the error is the field's `aria-describedby` (`role="alert"`) and sets `aria-invalid` |
| general | Slider, ChoicePicker, CheckBox | form primitives | bound to the data model | labelled controls |
| general | Button | `Button` | one declared event, context ≤ 12 keys / 4 KiB | the only action source |
| general | Table | `Table` | 8 × 50 | header cells |
| general | **Chart** `{title, labels, series}` | a `Table` with bars (`data-generative-chart`) | labels ≤ 12, series 1–4, one finite value ≥ 0 per label — else **`bad_chart`** | the table *is* the text alternative: caption = title, every value printed in `tabular-nums`, bars from zero, colours from `--chart-N`, series also named in a header |
| general | **Progress** `{label, value, max?}` | `Progress` primitive | numbers or bindings | `aria-label` from the label, percent printed |
| domain | **ArchitectureFlow** `{title, nodes}` | `figure` + ordered list, kind `Badge` | 2–8 nodes, kind ∈ client/server/data/external/job | a list in reading order with an `aria-label`; arrows are decorative |

Chart is a bar chart only, drawn as a table rather than with `SimpleChart`: the composite
layer may not import `viz` (architecture gate), and a table with every value printed needs no
separate data description. A complete batch that only deletes a surface no longer trips
`missing_root` — `render_surface` can remove what it showed.

**Cost of the extension** (`bun run genui:bench`, 2026-11-24):

| | Before (13) | After (18) | Delta |
|---|---|---|---|
| Catalog prompt, Express | 2,026 | 2,435 | +409 (+20%): Expandable 63, Notice 63, Chart 90, Progress 53, ArchitectureFlow 81, TextField.error 12, instructions ~47 |
| Catalog prompt, JSON | 5,179 | 5,941 | +762 |
| Bench `lazyChunks` gzip | 95.2 KB | 100.1 KB | +4.9 KB |
| Eager entry gzip | 1,261 B | 1,261 B | 0 |

The production renderer chunk and the total-client-JS ratchet (ceiling 2,510 KB, last
measured 2,421.1 KB) were not re-measured with this extension — that needs
`validate:build`.

**Catalog examples** (`fixtures/catalog-examples.ts`, `GENERATIVE_SURFACE_CATALOG_EXAMPLES`):
one committed surface per job the newer components exist for, each as v1.0 messages and as
Express with its follow-up batch — `step-form` (multi-step with Progress, a bound field error
and a Notice as validation feedback: 151 + 41 Express tokens), `cost-explorer` (Slider and
Chart, then a two-series chart: 109 + 75), `request-flow` (ArchitectureFlow: 129). The compile
test proves the two forms agree, the policy test that they pass, the render tests read their
markup; the interop showcase lists them.

## Measured comparison

Same four scenarios, same catalog, `gpt-tokenizer` o200k (`bun run genui:bench`,
`scripts/generative-ui/bench-report.json`). *Baseline* = the existing approach: a fixed card
fed structured tool data (the card's code is not counted — it is the cost that grows).

| Scenario | Baseline | A2UI JSON | A2UI Express | json-render |
|---|---|---|---|---|
| Requirements form | 165 | 362 | 224 | 321 |
| Technology comparison | 125 | 264 | 168 | 221 |
| Architecture selection | 99 | 294 | 173 | 250 |
| Dynamic update, first batch | 19 | 123 | 43 | 76 |
| Dynamic update, follow-up | 73 | 173 | 100 | 185 |

- Catalog prompt: **2,435 tokens (Express) vs 5,941 (JSON)** for the 18-component catalog
  (2,026 / 5,179 at 13) — the prompt, not the payload, dominates; Express wins both.
- Adversarial validation: **20/20** fixtures behave as specified (19 refused with a code,
  script-like text accepted as inert text). Four are graph-amplification cases: a shared
  diamond, one container repeating a child, an update that rewires an accepted tree into
  shared references, a cycle among disconnected components.
- Bundle (measured 2026-11-24, gzip level 9, 0 bytes of Lit): see [Bundle](#bundle) — the
  renderer's own chunk is **70.4 KB gzip** in the production build.
- json-render core ≈ 4.3 KB gzip (research run) — the lighter renderer, kept as the measured
  fallback because it has no A2UI interop beyond a v0.8 docs recipe.
- OpenUI Lang was smallest in the research run (103 vs Express 131 tokens on a reference UI)
  but its Svelte binding lags two majors and it runs install-time telemetry — rejected.

What was not measured: time to first meaningful render with a live model, structural
validity rates per provider, interaction correctness with a real user. Those need a live
turn (planned, see [plan.md](../architecture/agentic-architecture/plan.md)).

## When to use / when not

Use when the shape of an answer is decided by the question and must be interactive: forms
for missing inputs, comparisons, choices, parameter exploration, an update to what is on
screen. Do **not** use it when the shape is known — a fixed card is cheaper (the baseline
column) and needs no catalog prompt; nor for anything that must persist data on its own.

## Security model

- Data, not code: no `{@html}`, no URLs with `javascript:`/`data:`/`vbscript:`/`file:`/`blob:`
  (also obfuscated), no catalog functions, no `__proto__`/`constructor` keys.
- Bounded: 120 components, depth 10, **240 rendered nodes**, 1,000-char strings, 16 KiB data
  model, 64 KiB per batch, 32 messages per batch, 40 children per container, table 8×50,
  action context 12 keys / 4 KiB (`limits.ts`).
- Structural: unknown components/properties, missing root or child, cycles, traversing
  binding paths and foreign surfaces/catalogs are refused before web_core sees them; the
  official `validatePayload` runs after the policy on the server.
- **Graph amplification.** web_core's `NodeResolver` builds one node per *reference*, eagerly,
  with no deduplication: a component listed by two parents, or twice by one container, renders
  twice (ordinal instance ids `id#2`). Measured: a 12-level two-way diamond of 13 components
  built 8,191 nodes in 147 ms; 30 levels would be 2^31. web_core's own graph check accepts it
  (no cycle). The policy therefore bounds the nodes `root` renders, counting every reference
  (`maxRenderedNodes`, refusal `too_many_rendered_nodes`), instead of forbidding sharing:
  reuse (one Divider in several places) stays legal A2UI, expansion does not. Pending
  children count as one placeholder each.
- **Linear validation.** The graph check walks each component once, children before parents,
  with a memoised height (depth) and a node count saturated at budget + 1 — O(components +
  references), whatever the expansion. The previous walk went once per path: measured
  512 ms for a 5-wide, 9-deep layered DAG and 1.76 s for 6-wide (12-wide, which the limits
  allow, would take minutes). Now: a 30-level diamond (62 components, 2^32 paths) checks in
  0.4 ms, the 12-wide layered DAG (110 components, 12^9 paths) in 0.5 ms; the tests hold
  both under 50 ms, in the policy and through the session.
- **The whole merged graph.** Every batch is checked as the previous accepted graph plus the
  batch: an `updateComponents` that rewires children, a `deleteSurface` (the count starts
  over), and disconnected components — a cycle among them is refused; their expansion counts
  the moment an update attaches them.
- **Defence in depth.** After web_core applies a batch, the session compares the resolver's
  live node count with the same budget and rolls the batch back if it is over, before Svelte
  renders anything (tested with the policy switched off). The check lives in the session,
  not in `GenerativeSurfaceNode`: the resolver builds the whole tree before any component
  mounts, so a counter in the Svelte tree would save no work.
- A surface **emits events only**. A button press is never an approval; anything that would
  change data becomes an ordinary server tool call behind the approval gate.
- Model text in a surface is untrusted text, rendered as text.
- Gate: `generative-ui.gate.test.ts` fails on any import of `lit`, `@lit/*`,
  `@a2ui/web_core/universal`, `…/catalogs/*` or the version barrels, on a static path from
  the lazy entry to web_core, on `@a2ui/agent` outside server code, on `{@html}`, and when
  web_core's catalog schemas are built with a zod 3 other than the app's.

## Failure modes

**A batch applies whole or not at all.** web_core's `processMessagesWithErrors` is not
atomic (source: `processing/message-processor.js`; pinned by a test): it processes each
message in its own `try`, keeps the messages before a failure, skips the failing one and
**still applies the ones after it**. A `createSurface` whose components fail validation
leaves the surface created and its data model set, without components. Within one
`updateComponents` web_core validates every component before mutating, so a single message
is atomic; a batch is not.

The session (`surface-session.svelte.ts`) therefore:

1. runs the policy over the merged graph — most refusals never reach web_core;
2. snapshots the data model (user edits included) before handing web_core the batch;
3. if web_core reports any error, or the resolver builds more nodes than the budget,
   discards the processor and rebuilds a fresh one from the last accepted surface (each
   component's latest definition — a v1.0 update replaces a component whole — plus the
   snapshot), then reports the refusal.

So the policy graph, the processor and the rendered tree always describe the same surface; a
refused batch leaves the previous interface usable (inputs bind, actions fire), and the next
valid batch applies on top of it. A rollback rebuilds the node tree, so Svelte re-renders the
surface once from the rebuilt nodes; rollbacks happen only on a refusal web_core finds.

- User-entered values survive a refused batch, and a valid batch keeps every value it does
  not write; a valid `updateDataModel` on a path the user edited replaces the edit (protocol
  semantics).
- `deleteSurface` empties the surface; a later `createSurface` may reuse the id, also within
  the same batch (the resolver follows the new surface model).
- Restore: `session.snapshot()` returns the surface as one `createSurface` message
  (components plus current data model); applying it to a fresh session rebuilds the same tree
  and values. Replaying a stored message log gives the same surface and the same refusals.
  A snapshot passes the policy again like any input — one whose user text grew past a limit
  is refused, not trusted.
- A pending child renders a placeholder while streaming. Unknown components render a text
  fallback naming the component.

## Bundle

Measured 2026-11-24 with `NODE_ENV=production bun run build` (gzip level 9) and
`bun run genui:bench`. The two earlier figures measured different things:

| Figure | What it counts | Before | After zod dedupe |
|---|---|---|---|
| Bench `lazyChunks` | Standalone Vite build of `LazyGenerativeSurface` with only svelte, bits-ui, cva, clsx external: web_core, zod, zod-to-json-schema, signals, **and** the v10r primitives (~76 KB pre-minify), valibot and paraglide messages, over 2 chunks | 107.6 KB | 95.2 KB |
| Production renderer chunk | The one chunk only the renderer uses; the primitives, Svelte runtime and helpers come from 19 chunks every other route already shares (each has 3–377 importers) | 82.7 KB | **70.4 KB** |
| Production zod 3 chunk | The app's `zod/v3` (pulled by zod-to-json-schema), shared with the chat client | 12.8 KB | 13.0 KB |

The bench figure moves by ~0.2 KB between runs (the paraglide message modules it bundles
vary). The bench is an upper bound for a page that has none of the primitives loaded; the production
chunk is what a page adds when a surface first shows (plus the zod 3 chunk if the chat has
not loaded it). Total client JS (perf ratchet) went from 2,432.1 to 2,421.1 KB.

**Two zod 3 copies, now one.** web_core 0.15 depends on `zod@^3.25` and nests its own
`3.25.76`; `zod-to-json-schema`, which web_core also imports, resolves `zod/v3` to the app's
zod 4.6.7. Both shipped (the nested one inside the renderer chunk, ~100 KB pre-minify).
`scripts/build/a2ui-zod-dedupe.ts` resolves web_core's bare `zod` to the app's `zod/v3` — the
same zod 3 API; the newer copy differs only by fixes (`__proto__` keys dropped on object
parse, an emoji regex). It is scoped to importers inside web_core and used by the app build,
the unit-test lane (web_core inlined, so its catalog validation is tested on the shipped
copy) and the bench, which asserts exactly one zod 3 copy. Remove it when web_core moves to
zod 4. Not checked against the dev server's dependency pre-bundling, which may keep both
copies there (correctness is the same either way).

## Upstream

`@a2ui/web_core` **0.15.0** and `@a2ui/agent` **0.1.0**, exact pins. 0.16.1 / 0.2.1 exist but
were inside the repository's 24-hour `minimumReleaseAge` cooldown when this was built; bump
by changing the pins and re-running the bench. web_core is 0.x and breaks often (0.16 listed
~20 breaking changes): read every release. No official Svelte renderer exists; the community
`svelte-a2ui` (one author) was not used.

## In the chatbot

| Piece | Where |
|---|---|
| Tool | `render_surface` in `TOOL_MANIFEST` (`risk: view`, `executor: server`, `capability: generative-ui`, `resultOrigin: system`, `reach: internal`) |
| Capability | `ai/capabilities/generative-ui.ts`: when-to-use guidance (text by default; a surface only for a comparison, a choice or a short form; one per answer) plus the generated Express catalog prompt, about 2,400 tokens, cache-stable |
| Updates | The orchestrator replays the thread's `render_surface` parts (`generative-ui/surface-history.ts`) into `turn.surfaceGraphs`, so a call that reuses a `surfaceId` is checked as an update of what the user sees |
| Rendering | `ChatThread` maps each render to a view (`surface-views.ts`): only a surface's latest render shows it, with every batch of that surface, so a reload rebuilds the same view; a superseded render shows nothing; a refused one keeps its status row |
| Persistence | No schema change: the tool part is persisted with the assistant message like every tool call, and an admitted press is persisted as the user row's `data-surface-action` part (below). Restoring a conversation restores its surfaces and its presses; nothing replays on restore — an action exists only when the user presses a Button |
| Actions | `chatbotSession.submitSurfaceAction` sends a **surface action record** `{ action, renderId, eventId }` as the message's only part and as `body.surfaceAction`; `POST /api/ai/chatbot` admits it through the surface action door |

### The surface action door

`generative-ui/surface-action-door.ts` checks a press against the **persisted** conversation,
read with the caller's user id (the client's history is not trusted for this):

| Refusal | When |
|---|---|
| `duplicate_event` | A user row already carries this `eventId`: a network retry, or a stored press re-sent after a reload (checked first) |
| `unknown_surface` | Another user's conversation, a surface it never showed, or a render the policy would refuse (a forged part) |
| `stale_surface` | The press names a render the assistant has since updated: a replayed or old event |
| `deleted_surface` | The latest render deleted the surface |
| `unknown_component` / `not_an_action_source` | The source is not a component of that version, or not a Button |
| `undeclared_event` | The Button declares a different event name |
| `duplicate_submission` | A user row already carries the same **submission key** — a double click or a second tab pressing with the same values (checked last, so a refusal above wins) |

A refusal is `409 surface_action_rejected`; the thread shows "already sent" for the two
duplicates and "this view is outdated" for stale and deleted surfaces.

**Event identity and dedup.** Two identities, two jobs:

- The **event id** (`eventId`, a `crypto.randomUUID()` minted per press) names one press. The
  same id twice is the same request delivered twice.
- The **submission key** (`surfaceActionKey`, canonical JSON — object keys sorted — of
  `renderId`, `surfaceId`, `sourceComponentId`, event name and resolved context) names what
  the press says. Two presses with the same key are the same submission, whoever minted them;
  changed values, or a press on a newer render, are a new submission.

Both are checked against the persisted user rows, so the rule holds across reloads and
serverless instances. The race between two concurrent requests is closed in the database,
not in memory: the admitted user row's id is `sa_` + 40 hex of
sha256(conversationId \0 submission key), and the orchestrator saves it with
`saveMessages(…, { claim })` — an `insert … on conflict do nothing returning` that runs before
any frame. The loser gets `409 duplicate_submission` and nothing of its turn is written. The
client also guards: one press in flight at a time, and no send when the thread already holds
the key. No new table or column.

**Presentation is not the prompt.** The persisted user row keeps the human-facing record —
`content` "Sent from the view: <event>" and the `data-surface-action` part — and
`ChatMessage` renders it as one line in the user bubble, from the part, after a reload too.
The model never sees that row as written: `surfaceActionPromptsForModel` turns every user
message that carries the part into one `<untrusted-content source="surface_action">` element
built from the parsed event (AI SDK's `convertToModelMessages` would drop a data part). The
client's own text for the turn never reaches the model. Admission authorizes nothing: the
chatbot is read-only, and a write implied by an event would go through that tool's own gate.

## Evaluation

**Offline, every run** (`server/ai/generative-ui/surface-conversation.test.ts`): a scripted
thread runs through the server's own doors — the `render_surface` tool, the history replay,
the surface action door — over rows shaped as the database persists them, with committed
fixtures standing in for the model. Six cases: several surfaces in one thread; a form
submission, its follow-up update (validation feedback) and a follow-up interaction on the
updated surface (the old render is now stale); duplicate submission and network retry versus
changed values; refused actions (crafted event, non-Button source, deleted surface); invalid
model output (`bad_chart`, an unknown component) refused as a result and recovered on the
same surface; a restored conversation that rebuilds the same surfaces and enforces the same
presses.

**Live, run locally** (no provider key in the cloud). `eval/golden-cases.json` carries eight
generative-UI cases, graded from the persisted trace. A case may script up to three
**follow-ups**: a typed question, or a press built from the persisted thread
(`eval/surface-press.ts`, `scriptedSurfacePress`: the latest render's Button for the event,
its context resolved after scripted value edits), optionally resent verbatim. Each follow-up
resends the stored thread as history and is graded as `turn N: <kind>`.

| Case | Turns | Grades |
|---|---|---|
| `genui-text-by-default` | 1 | never calls `render_surface` |
| `genui-comparison-surface`, `genui-requirements-form` | 1 | `renders-valid-surface`, at most two calls |
| `genui-form-submit-follow-up` | 2 | a valid form; then its press, resent verbatim: `refuses-repeated-press`, the answer cites only surfaced sources |
| `genui-chart-recalculate` | 2 | `renders-component` Chart; then the Recalculate press: `updates-surface` |
| `genui-multi-step` | 2 | `renders-component` Progress; then the Next press: `updates-surface` |
| `genui-architecture-flow` | 1 | `renders-component` ArchitectureFlow |
| `genui-text-follow-up` | 2 | a valid surface; then a typed question that never calls `render_surface` |

```bash
podman exec v10r bun run ai:eval -- --cookie '…' --only genui-form-submit-follow-up,genui-chart-recalculate
```

None has run against a live model yet. Still owed: the fixed-tool, A2UI JSON and json-render
comparison on live models (token, time-to-first-meaningful-render and cost figures today come
from the offline bench only) and an accessibility review of a model-composed surface.
