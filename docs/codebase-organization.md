# Codebase Organization

Where code lives, and why it lives there.

This document is deliberately short. The repository is meant to answer "where does X go?"
by itself — through directory names, barrels, and the checks in
[`src/lib/architecture.gate.test.ts`](../src/lib/architecture.gate.test.ts). What remains
here is the part a tree cannot show: the reasoning, and the constraints that come from
outside the codebase.

For the runtime view — request flow, the hooks pipeline, the layer hierarchy — see
[`system-abstraction.md`](./system-abstraction.md).

---

## The one decision that matters

**Adapter or domain?** Getting this wrong couples business logic to the framework, and it
is the only structural mistake here that is expensive to undo.

A **domain** (`src/lib/server/[domain]/`) is framework-free. It returns values and `null`;
it never returns a `Response`, never throws `redirect()`, and never imports
`@sveltejs/kit` or `$app/*`. That is what lets one function serve a page load, a REST
endpoint, an AI tool, and a cron job without modification.

An **adapter** translates a domain to one transport. There are exactly three kinds, and
each announces itself:

| Kind | Where | Example |
|---|---|---|
| Route adapter | `+page.server.ts`, `+server.ts` | handles `fail`/`redirect`/`error`, converts `Date` → ISO |
| Shared HTTP toolkit | `src/lib/server/http/` | response envelopes, pagination, bounded body reads, rate limiters, route guards |
| Domain-local | `*.adapter.ts`, `*.hook.ts` | `mcp/http.adapter.ts`, `analytics/collector.hook.ts` |

The gate enforces this. There is no exception list to keep in sync: if a module under
`server/[domain]/` needs the framework, it is an adapter and belongs in one of the three
places above.

---

## Product, demonstration, plumbing

This repo is a pattern library, so the most important thing a reader needs to know about
any file is which of these it is.

- `src/lib/server/[domain]/` — product behaviour.
- `src/lib/server/showcases/[name]/` — exists to **demonstrate** a pattern. Written to the
  same standard (these are the reference implementations people copy), but owns no product
  behaviour. Deleting a showcase page must never break anything outside it.
- `pattern-library/` — the registry that *is* the product: pattern records, their schema,
  and the drift guard. `mcp/` (stdio, bare Bun) and `src/lib/server/mcp/` (hosted HTTP) are
  two transports over it; the generated pages under `docs/pattern-library/` are a third
  reader. Reachable from the app as `$patterns`.

A showcase spans three directories, one per concern, and they are named alike:
`$lib/showcases/[name]/` (shared vocabulary) · `components/showcases/[name]/` (UI) ·
`server/showcases/[name]/` (server logic).

---

## Data below the components

Some things are neither UI nor server logic — they are catalogues that several UI features
read. They live directly under `src/lib/` so that no feature directory has to import
another:

| | Owns | Read by |
|---|---|---|
| `$lib/3d/` | scene, part, and customization registries | the 3D viewer **and** blog scene embeds |
| `$lib/desk/` | persisted layout shape, panel catalogue, help copy | the Desk UI, the app shell's command palette, **and** the `desk` DB schema |
| `$lib/showcases/catalog/` | the showcase card tree and section anchors | the hub, nav, both search lanes, the sitemap, the Neo4j projection |

`$lib/desk/panels.ts` lists the panel types; the directories under
`components/desk/panels/` are named to match, one per entry. The list and the tree are the
same fact.

---

## `db/` — two trees, on purpose

`schema/[namespace]/` groups tables by **storage**. `db/[domain]/` groups access by **call
site**. They are not 1:1 and should not be forced into it: `schema/personalization` is read
by four different domains, and `schema/auth` is mostly Better Auth's.

Reads and writes split into `queries.ts` / `mutations.ts`, in one of two places:

- **Default — `db/[domain]/`**, for incidental CRUD.
- **Co-located in `[domain]/`** when the query *is* the domain logic and cannot be
  meaningfully separated from it — retrieval ranking (`retrieval/`), hybrid search
  (`llmwiki/`), post rendering (`blog/`).

The test is not "is it SQL" but "would someone reading this domain expect to find it here".

**Push-only.** There is no `drizzle/` migrations directory; `db:push` syncs directly. Every
`pgSchema()` must be exported through `schema/index.ts` *and* listed in
`drizzle.config.ts`'s `schemaFilter`, or push silently omits it.

`db/` is the sink: it imports no sibling domain, so the import graph stays acyclic.

---

## Components — the barrel is a bundle boundary

Layer order, leaf → root: `primitives/` ← `composites/` ← `layout/` ← `shell/` and the
feature directories. Feature directories never import each other; when two need the same
component, it moves *down* a layer rather than sideways (that is how
`composites/citation/` and `primitives/color-input/` came to exist).

The default `$lib/components` barrel is the **cheap** surface. Anything pulling a heavy or
optional dependency — viz engines, Three.js, the markdown sanitiser — or app-specific
chrome is deep-import-only. Adding a heavy dependency to a barreled component is a
bundle-size regression, not a style preference.

Which directories are excluded is asserted in the gate, not listed here: the prose version
of that list drifted to naming two of fourteen.

---

## Routes

`src/routes/[[locale=locale]]/` is the localized tree; `src/routes/api/` is the parallel
un-localized REST/SSE tree. Auth gates live in `+layout.server.ts` files, not route groups.

Route-local private folders use a leading underscore (`_components/`, `_sections/`).
Promote to `$lib/components/[layer]/` only when a second route needs the same thing.

**Global CSS belongs to the root layout, not the locale layout.** `uno.css`, `src/app.css`,
and the fonts are imported once in `src/routes/+layout.svelte`. This is load-bearing: a
`+page@.svelte` breakout sheds the locale layer, so anything it needs globally must live
above it. The full-screen 3D viewer rendered token-less until these were hoisted.

---

## Naming

- Server `.ts`: kebab-case. Components: PascalCase `.svelte` in a kebab-case folder.
- Barrels are always `index.ts`. Tests are co-located `*.test.ts` — no `__tests__/`.
- Runes state files must use `.svelte.ts`. App-wide: `src/lib/state/[concern].svelte.ts`.
  Component-local: co-located as `[component].state.svelte.ts`.
- Internal/special files take a leading underscore (`_better-auth.ts`).

---

## Where does a new file go?

1. **Thin adapter?** (handles `fail`/`redirect`/`error`, converts types, no business logic)
   → the route file, or `server/http/` if several adapters share it.
2. **Business logic?** → `server/[domain]/[feature].ts`, exposed via the domain's `index.ts`.
3. **Only there to demonstrate a pattern?** → `server/showcases/[name]/`.
4. **A Postgres query?** → `db/[domain]/queries.ts`, unless the query *is* the domain logic.
5. **A table?** → `db/schema/[namespace]/`, exported through `schema/index.ts` **and**
   listed in `drizzle.config.ts`.
6. **A Valibot schema?** → server-only: `server/schemas/`. Client-importable:
   `src/lib/schemas/`.
7. **A component?** → the lowest layer that all its consumers can reach. Route-local until
   a second route needs it.
8. **Reactive state?** → app-wide `src/lib/state/`, or co-located with its component.
9. **A catalogue two features share?** → directly under `src/lib/`, below the component
   layer (see `$lib/3d`, `$lib/desk`).

---

## Constraints that come from outside

These are the reasons behind placements that otherwise look arbitrary.

- **`pattern-library/` sits outside `src/`** because `mcp/server.ts` runs under bare Bun in
  an ephemeral, network-less container with no Vite — it must reach `registry.json` by
  relative path. The app gets the same file through the `$patterns` alias.
- **`pattern-library/schema.ts` is split from `load.ts`** so the app can import the pattern
  types without pulling `import.meta.dir`, a Bun API that breaks `svelte-check`. One type
  declaration, two runtimes.
- **`server/retrieval-shared/embed-config.ts` is dependency-free** so standalone Bun ingest
  scripts can import it by relative path. Never re-declare those constants;
  `retrieval/config.ts` re-exports them so retrieval code has one place to look.
- **`$lib/showcases/catalog/registry.ts` uses relative imports**, not `$lib`, so it stays
  resolvable from `scripts/db/catalog-sync.ts` under bare Bun.
- **`auth/admin-ids.ts` is deep-imported on purpose**: it is a framework-free leaf that
  exists precisely so callers can avoid constructing the Better Auth instance that
  `auth/index.ts` builds.
- **`server/mcp/` keeps `http.adapter.ts` DB-free** so the protocol tests need no mocks;
  `telemetry/writer.ts` is the only module there that touches the database.

---

## Related

| Document | Covers |
|---|---|
| [`system-abstraction.md`](./system-abstraction.md) | Runtime view: layers, request flow, hooks pipeline |
| [`blueprint/architecture/multi-client-core.md`](./blueprint/architecture/multi-client-core.md) | The hexagonal core in detail |
| [`src/lib/architecture.gate.test.ts`](../src/lib/architecture.gate.test.ts) | The invariants, executable |
| [`CLAUDE.md`](../CLAUDE.md) | Agent instructions and house rules |
