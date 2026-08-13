---
name: visy-process
description: Model processes, flows, and lifecycles — pick sequence vs flowchart vs state diagram correctly and depict failure paths, not just the happy path. Use whenever depicting a request lifecycle, auth or data flow, pipeline, background job, state machine, event propagation, or any "what happens when X" behavior. Every arrow needs semantics (sync/async, always/conditional), every flow needs a named entry and exit, and node labels use real names from the repo, never placeholders.
metadata:
  family: visy
---

# Process modeling

A process depiction is a claim about behavior. Model what actually happens — including what happens when it fails — using the notation whose structure matches what varies. Syntax mechanics and validation live in `visy-diagram`; load it before emitting.

## Pick the type by what varies

| What varies | Type | Misuse signal (switch when you see it) |
|---|---|---|
| Messages between actors over time | `sequenceDiagram` | A flowchart whose nodes are all "A calls B", "B calls C" — that is a sequence wearing a flowchart costume |
| Branching decisions | `flowchart` | A sequence diagram with `alt` blocks nested 3 deep — the branching is the subject, draw a flowchart |
| One entity's modes and transitions | `stateDiagram-v2` | A flowchart full of back-edges and cycles — lifecycles want state notation |
| Parallel responsibilities across roles | `flowchart` with swimlane subgraphs | One long column where three different systems take turns |

## Failure paths are half the model

A happy-path-only diagram is marketing. For each step ask: what happens on error, timeout, denial, partial success? Show the error edges, retry loops, and compensation paths — or explicitly annotate "errors omitted, see <where>" so the omission is a decision, not an accident.

Every flow has one named entry edge and one named terminating edge, and every path must reach a terminator. If you cannot name where a path ends, the model is incomplete — that is a finding worth reporting.

## Arrow discipline

Every arrow lies until labeled. For each edge, answer: sync or async? always or conditional? startup-time or request-time? Label the edge (`-->|on 401|`) or define a legend once (e.g. "dashed = async") and follow it consistently across every view in the document.

## Evidence artifacts

Use real names from the repo: `authCaptchaGate → authHandler`, `POST /api/mcp/public`, `jobs/delivery-scheduler` — never `Service A → Service B` or `Step 1 → Step 2`. If you do not know the real names, Grep for them first; the repo is the ground truth, and a diagram that teaches nothing concrete fails the education test.

## Project canon — processes worth depicting correctly

- The composition root: `src/hooks.server.ts` boots three background modules, then runs the 14-middleware `sequence()` — order is load-bearing, so a depiction that reorders it is *wrong*, not simplified.
- The multi-client core: one domain function behind four adapters (`+page.server.ts`, `+server.ts`, AI tool, job) — one diagram, four entry edges converging on a single door.
- Background lifecycles: `agents`, `jobs/scheduler`, `jobs/delivery-scheduler` — setup → run → teardown, not just "runs".
- The `sys` agent establishes runtime truth (traces, failure modes); visy-process turns that trace into the picture. Depict what is established, not what is assumed.

## Interactive process diagrams in-app

Use `FlowDiagram` / `StateDiagram` (`$lib/components/viz`, @xyflow/svelte) — deep import only, and the parent must set an explicit height; the component fills it. Static Mermaid is for docs and PRs, not app pages.
