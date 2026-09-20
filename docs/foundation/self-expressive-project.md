# Self-Expressive Project

The codebase and the database explain the system themselves — names, structure, schemas, relationships, constraints — so documentation and comments only have to explain the why. A developer who reads the project understands how the product works and how its concepts relate without being told.

> **Code expresses behavior. Structure expresses architecture. Schema expresses the domain.
> Constraints express the rules. Documentation explains the why.**

---

## Why this is a foundation principle

Velociraptor is a pattern library: an AI agent reads it and adapts what it finds to a new
project. An emulator cannot ask the author what a name meant or why a table has that shape. It
has only the artifact. So the artifact has to carry the meaning:

- **Prose drifts; structure with a gate cannot.** A paragraph that describes the architecture
  is true on the day it is written. A test that fails when a domain imports a framework is true
  every day. Where a rule can be executable, it is (see [Executable form](#executable-form)).
- **Emulation needs the *why* beside the *what*.** The code shows what is done; the comment or
  the doc says why it is done that way and what breaks if it isn't. An adapter who sees only
  the what copies the shape and loses the reason.
- **Two sources of truth is one too many.** A fact recorded twice is a fact that will
  disagree with itself. One owner, referenced everywhere else — for constants, for schemas,
  for docs hubs, for the vocabulary.

## Five facets

| Facet | What it means | Where v10r enforces it |
|---|---|---|
| **Self-expressive code** | Functions, types and modules communicate their purpose without explanatory comments. A name says what a thing is; one concept has one name. | [naming.md](../naming.md) is the vocabulary; `src/lib/naming.gate.test.ts` fails on a retired term, a second declaration of an existing name, a shouted acronym, a file named for a bucket |
| **System-reflective architecture** | The codebase structure mirrors the product and domain architecture. Reading `src/lib/server/` reads the product's domains; reading a route reads a thin adapter around one of them. | [codebase-organization.md](../codebase-organization.md) is the map; `src/lib/architecture.gate.test.ts` holds the four invariants as a ratchet — a new violation fails, and so does a stale allowance |
| **Self-expressive data model** | Tables, columns, relationships and constraints communicate their meaning directly; the database structure mirrors the domain model. A rule that can be a `CHECK`, a foreign key or an enum is not a comment. | `src/lib/server/db/schema/` is pushed as written (no migration files to read around); `src/lib/server/db/schema-filter.gate.test.ts` asserts every declared `pgSchema()` is pushed; `src/lib/types/db-enums.drift.test.ts` binds the one client-side enum mirror to the schema, order included |
| **Comments explain why** | Rationale, constraints, invariants and non-obvious decisions — never what the code already says. | Practice, measured: a repo-wide cleanup (2026-08-17) could remove 3.8 % of comment lines, because nearly every remaining line states a constraint — an FK behaviour, a legal basis, an ordering rule. The rule is *why, not what* — it is never *fewer* |
| **One source of truth** | A fact or rule has one authoritative owner; everything else references it. | `src/lib/server/docs/doc-filter.ts` (which docs are public — read by the routes *and* the ingester), `src/lib/docs/sections.ts` (`DOCS_SECTIONS` — the hub *and* the nav), `src/lib/server/retention/schedule.ts` (fifteen retention rules; seven jobs and the public privacy page read it, and `schedule.gate.test.ts` fails a job that hard-codes a window) |

## Executable form

The principle is testable. Each gate below fails on a new violation *and* on a stale
allowance, so the exemption lists only ever shrink — an allowance is an argument for keeping
something, not a place to hide it.

| Gate | Fails when |
|---|---|
| `src/lib/architecture.gate.test.ts` | a domain imports a framework; a `Date` crosses an adapter unserialized; `redirect`/`error`/`fail` leaves an adapter; a domain reaches sideways into another instead of down through a barrel |
| `src/lib/naming.gate.test.ts` | a retired term returns; an acronym is shouted inside a mixed-case name; an i18n key has no namespace; a name is declared twice; a file is named for a bucket (`utils.ts`, `helpers.ts`, `service.ts`, …) |
| `src/lib/server/db/schema-filter.gate.test.ts` | `drizzle.config.ts` lists a different set of schemas than the code declares — the one omission `db:push` would silently ignore |
| `src/lib/types/db-enums.drift.test.ts` | the client mirror of a `pgEnum` differs from the schema in members or order |
| `src/lib/server/retention/schedule.gate.test.ts` | a sweep job carries its own retention window instead of reading the schedule |

The gate is the authority. A doc that says "domains are framework-free" is a claim; the test
is the fact.

## Applying it to a change

Before the edit, one question per kind of change:

| You are adding… | Ask | Owner |
|---|---|---|
| a name | Does this concept already have one? Is this word already spoken for? | [naming.md](../naming.md) — read it, then add to it |
| a file | Which responsibility owns it, and which layer? | [codebase-organization.md](../codebase-organization.md) → *Where does a new file go?* |
| a table or column | Can the rule be a constraint, a foreign key, an enum — instead of a comment or a runtime check? | [blueprint/data/README.md](../blueprint/data/README.md) |
| a rule or constant | Who owns it? Does a domain policy file already? | `server/[domain]/config.ts`, never a shared constants module |
| a comment | Does it say *why*? Would deleting it lose a constraint, an invariant, a decision? | If it only restates the line below it, delete it |
| a doc | Is this the owner of the fact, or a summary of another owner? | Reference the owner; hubs route, they do not summarize |

## Anti-patterns

| Anti-pattern | Why it fails the principle | Instead |
|---|---|---|
| A bucket file — `utils.ts`, `helpers.ts`, `shared.ts`, `core.ts` | The name says nothing about the responsibility; everything unrelated ends up inside | Name the file for what it owns |
| A comment that restates the line below it | Two statements of the *what*, zero of the *why*; they drift apart | Say why, or say nothing |
| A god-config module | A hundred constants with no owner; every domain reaches into it and the import graph becomes one knot | Policy belongs to its domain |
| A mirror without a drift test | The copy is right on the day it is made | Bind it, or derive it |
| A doc that summarizes another doc | A second source of truth, one refactor behind the first | Link to the owner |
| A canonical name reused for a second concept | A reader who learned the word once now guesses wrong half the time | One name, one concept — pick a new word |
| A rule enforced by convention alone | Convention is prose; it drifts like prose | Make it a gate where it can be one |

## Related

- [naming.md](../naming.md) — the vocabulary: canonical term per concept, retired terms, spoken-for metaphors
- [codebase-organization.md](../codebase-organization.md) — where code lives and the constraints behind non-obvious placements
- [principles.md](./principles.md) — the decision constraints that drive stack choices
- [blueprint/data/README.md](../blueprint/data/README.md) — the schema workflow the data-model facet rests on
