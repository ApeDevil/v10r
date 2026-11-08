# How Architecture Engineering works

Architecture Engineering turns what is known about a workload into explained architectural
decisions, an editable architecture model, and static checks. Everything below is
deterministic: ordered rules over a closed vocabulary. There are no weights, no scores and
no LLM, so the same input and engine revision always give the same output, and every output
says why.

Code: `pattern-library/architecture-engineering/` (framework-free and dependency-free, so the
stdio MCP server can run it under bare Bun). UI: `/studio/architecture`. MCP:
`explore_architecture`, `check_architecture`. Registry: `architecture-engineering`.

## The five domains

| Domain | Question | Decision records |
|---|---|---|
| Execution | Where and in which runtime does the work run? | `compute-placement`, `compute-runtime` |
| Communication | How do the parts talk? | `interaction-style` |
| Data | Where does data live and where is it processed? | `data-store`, `processing-locality` |
| Deployment | How many deployable units, and which shape? | `deployment-shape` |
| Performance | What do we do when it is too slow? | `compute-acceleration` |

## Decision records

A decision record (`decision-record.ts`, catalogue `decisions.json`) is an ADR made
executable: identity and revision, the problem, the alternatives (each with benefits,
drawbacks, `prefer_when`, contraindications and pattern ids), **ordered rules**
(`when` → `choose`, with `because`), a fallback, what would make you revisit it, the evidence
(each item carries its kind), migrations between alternatives, and how to confirm the choice.

`parseDecisionCatalog` validates the catalogue when it is imported; `patterns:validate` checks
that every pattern id resolves in the registry and every evidence reference exists (a route,
an app route, or a file with its anchor).

### Why ordered rules and not a score

A weighted matrix hides its reasoning in the weights, and two matrices disagree for reasons
nobody can read. An ordered rule table says exactly which fact decided, and a reviewer can
argue with one rule. The order encodes priority: a hard constraint (offline, sensitive data
that must not leave the device) is written before a preference.

### How a rule is evaluated

For each decision, rules are tried in order (`explore.ts`):

1. A rule whose every condition matches a **known** factor value **fires**. Its alternative is
   chosen with `basis: 'rule'`, and the inputs it used are listed.
2. A rule blocked only by **unknown** factors does not fire. It becomes **missing
   information**: "if these factors were known, this could become X".
3. A rule contradicted by a known value is recorded on the alternative as `contradicted_by`
   (which factor, its value, what the rule needed).
4. With no firing rule, the **fallback**, always the simplest alternative, is chosen with
   `basis: 'fallback'` and labelled a default.

Every alternative not chosen therefore carries a reason: contradicted, reachable with more
information, or outranked by an earlier rule. Unknown stays unknown; nothing is inferred.

### Evidence kinds

`measured` (with its conditions) · `live-measurement` (run on your device, not recorded) ·
`reference-implementation` · `documented-reasoning` · `external-study` · `estimate`. The
Studio shows the kind next to every claim. **Evidence labs** (`evidence-labs.ts`) link the
existing v10r experiments (`/showcases/wasm`, `/showcases/external-service`) and state the gap
where none exists: application vs database processing has no v10r measurement yet, so that
decision rests on documented reasoning and says so.

## The architecture model

`architecture-model.ts`: zones (trust or runtime boundaries), components (`ArchitectureNode`,
one of twelve `NodeKind`s, each with allowed placements, accepted protocols and
infrastructure requirements), connections (protocol, sync/async, data flow, authentication,
failure handling), and constraints. Positions live apart, in `ArchitectureLayout`, after
the C4/Structurizr split of model and view: moving a box never changes the architecture, and
an exported file (`ArchitectureFile`) round-trips byte-stably through
`stringifyArchitectureFile`.

The model is **untrusted input** wherever it comes from (import, local storage, MCP):
`parseArchitectureModel` is strict (unknown keys refused, not dropped), bounded
(`MODEL_LIMITS`), checks integrity (unique ids, no dangling references, placements allowed for
the kind), and fails closed. Nothing in a model is executed or rendered as HTML.

Edits go through `model-operations.ts`: each returns a new model or a named refusal
(`connection.self`, `placement.not-allowed`, `zone.in-use`, …), the same convention as
product composition. Explore → Design builds a starting model from a recommendation
(`model-from-recommendation.ts`).

## Static checks

`checks.ts` returns `ArchitectureFinding`s, each with a fixed severity per code, a category,
what was detected, why it matters, the constraint, a fix and patterns. Severities: `error` (a
stated fact contradicts a rule, e.g. a secret on a browser component), `warning` (usually a
problem), `unknown` (the model leaves a decisive property unstated), `recommendation` (a
simpler or safer option exists). **Security** is its own category and is checked by
`checkSecurity`, apart from runtime, communication, data and structure (`checkDesign`), so a
cosmetic check can never mask or downgrade it. Failure-handling checks apply only across
service boundaries; a plain database call is not flagged.

## Comparison and evolution

`compareArchitectures(baseline, variant)` diffs components, placements, connections, zones
and infrastructure requirements, counts deployment units, managed dependencies, network
connections and trust-boundary crossings, and lists findings introduced and resolved. Its
assessment is **qualitative** (`basis: 'qualitative'`): it says "one more synchronous network
call", never a number of milliseconds, and a test enforces that. A **variant**
(`deriveVariant`) records its baseline and the reason for the change; the evolution example
walks a monolith → background worker → Rust service → client compute.

## Studio

`/studio/architecture` lists the principles, the decision records and the labs. Its three
modes share one state (`_state/architecture-studio.svelte.ts`) under the area's layout, so
moving between them keeps every edit:

- **Explore** — factor selects (unknown first), ten example workloads, the explained
  recommendation, transfer to Design.
- **Design** — the canvas (xyflow, loaded lazily through `FlowDiagram`), plus a keyboard path
  through component and connection lists and inspectors; undo/redo with typing coalesced;
  local drafts; JSON import/export through the parser.
- **Engineer** — findings grouped by category, the decisions behind the model, variants with
  their reason, and the comparison.

Drafts are local-first (`localStorage`, labelled as such); the file format is the contract, so
a server store can come later without changing the model.

## Limits

- The catalogue is seven decisions; it covers the choices v10r itself has evidence for.
- Checks read structure and stated facts; they do not measure. A clean model is not a fast one.
- Comparison is qualitative. Numbers belong to labs, cited as evidence with their conditions.
- Decision content is English, like the registry; the Studio chrome is localized.
