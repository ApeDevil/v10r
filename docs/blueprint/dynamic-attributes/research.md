# Dynamic Attributes — research report

Research behind [pattern.md](./pattern.md), done 2026-11-05 before any code was written. Part 1
is the internal inventory: what v10r already had that the pattern reuses or had to avoid
duplicating. Part 2 is the external survey: prior art and building blocks, with each claim's
source quality marked.

## Part 1 — internal inventory

| Need | Found in v10r | Decision |
|---|---|---|
| Typed value controls | `Input`, `Textarea`, `Switch`, `Select`, `TagInput`, `Button` in `#lib/components/primitives` | Reused; one thin control per kind. `Select` gained `id` and `aria-label` so each type select has an accessible name. |
| Validation library | Valibot everywhere (`forms.md`: 1 kB, tree-shakeable, server/client parity) | The codec's frames are Valibot `strictObject`s; no JSON Schema runtime. |
| A document saved by autosave with conflicts | `spreadsheet-autosave.ts`, `spreadsheet-drafts.ts`, the unsaved-work registry (the *versioned document session* pattern) | Lifted into `#lib/state/document-autosave.ts`, `document-drafts.ts`, `document-sessions.ts`, generic over content, with a new `rebase(resolve)` for kinds that can merge. The spreadsheet now runs on the same code. |
| User documents on the desk | `desk.file` + detail tables (single-table inheritance), `desk.file_revision` pre-images, row locks + version, 409 on a stale save | A third file type, `record`, with detail table `desk.record`; revisions gained a `document` column. No parallel storage. |
| Panel hosting | Dock layout, panel registry (`#lib/desk/panels.ts`), panel menus, desk bus, About help, Explorer adapters and context menus | Reused; `RecordPanel` is an adapter. The Explorer's "new spreadsheet" dispatch became `dispatchNewDeskFile(…, type)`. |
| AI context and retrieval | Panel context registry, `desk_read`, retrieval sync of pinned files, proposal targets typed `'spreadsheet' \| 'markdown'` | Widened to `DeskFileType`; records project to `label: value` text. The assistant reads records; no write tool (a deliberate scope limit). |
| Undo | No shared undo utility (CodeMirror owns the editor's) | A small history in the attribute editor: snapshots share unchanged attributes, keystrokes coalesce. |
| Existing "attributes" or "custom fields" code | None — naming gate and vocabulary checked (`docs/naming.md`) | New canonical terms registered: attribute, attribute kind, self-describing record, format. |

Gates the work had to respect: architecture invariants (`architecture.gate.test.ts`), naming
(`naming.gate.test.ts`: `attributes_*` became an i18n area), component-first, color tokens,
docs-mapping (every showcase doc link a published manifest entry), and the pattern-library
registry check.

## Part 2 — external survey

Legend: **[V]** checked against a primary source in this session. **[S]** secondary source
(an aggregator or blog). **[U]** not verified in this session (background knowledge, treat as a lead).

### 1. Comparison table

| Candidate | Approach | Maturity | Security notes | Svelte 5 | License | Fit for v10r |
|---|---|---|---|---|---|---|
| Notion property model | Schema on data source, `id` + `name` + `type` + type-config object; ids stable across rename [V] | Established, commercial API | n/a (data model only) | n/a | Proprietary service | **Model to emulate** |
| Airtable field model | Field ids (`fld…`), 32 field types, select options carry `id` + `name` [V] | Established | n/a | n/a | Proprietary | Model to emulate (option ids) |
| Baserow | Real Postgres table per table, real column `field_{id}` per field [V] | Established | Runtime DDL | n/a (Vue/Django) | MIT core + premium [V] | Contrast: shared-schema tables, not inline |
| Directus | Fields **are** DB columns + metadata; "alias" fields have no column; JSON type exists [V] | Established | Runtime DDL | n/a (Vue) | v12: MSCL (source-available, GPLv3 after 4 y); before: BSL with $5M grant [V] | Contrast; license unsuitable to embed |
| NocoDB | Metadata over real columns of an existing DB [U] | Established | Runtime DDL [U] | n/a | AGPL-3.0 (earlier) / changed since [U] | Contrast only |
| Form.io | JSON form definition + server; JS strings for conditions, calculated values, validation; optional "protected evaluator" based on JS-Interpreter [V] | Established | CVE-2020-28246 SSTI/RCE in `formio` (vendor disputes; NVD 9.8; Snyk: no fixed version) [V]; JS-in-JSON is a code-injection surface by design | No first-party Svelte | OSS core + commercial enterprise [U] | **Avoid** (eval-shaped design) |
| JSON Forms (EclipseSource) | JSON Schema + separate UI Schema; renderer sets React, Angular, Vue 3 [V] | Established (v3.x) [U version] | Uses Ajv [V] (CSP: needs `unsafe-eval` unless precompiled) | **No** Svelte renderer set [V] | MIT [U] | Concept reference only |
| SurveyJS | Survey JSON parsed by a UI library | Established | Expression language (own parser) [U] | No Svelte package [U] | Form Library **MIT**; Survey Creator, Dashboard, PDF **commercial per-developer** [V] | Avoid: the builder (what we need) is paid |
| react-jsonschema-form | JSON Schema + uiSchema, pluggable validators | Very active, v6.11.1 released 2026-11-05 [V] | Ajv validator by default [U] | React only | Apache-2.0 [U] | Not usable (React) |
| svelte-jsonschema-form (`@sjsf/*`, x0k) | Svelte 5 port of rjsf ideas; themes (shadcn4, daisyui5, flowbite3, skeleton4, basic); validators Ajv8, cfworker, schemasafe, **Valibot**, Zod4 [V] | Young but active: `@sjsf/form` 3.3.1, released ~late Oct 2026 [S]; ~170 stars [V] | Depends on chosen validator | **Yes, Svelte 5 native** [V] | MIT AND Apache-2.0 [V] | Renders a *fixed* schema well; does not provide the "user edits the schema" UX |
| Ajv (draft 2020-12) | Compiles schema to JS via code generation | Very established | Browser CSP needs `'unsafe-eval'` unless standalone-precompiled; schemas must be trusted; ReDoS via `pattern`; RE2 swap possible [V] | n/a | MIT | **Wrong tool for user-authored schemas at runtime** |
| @cfworker/json-schema | Interpreting validator (no codegen; built for Workers where Ajv can't compile) [V/inference] | Stable, 1.12.8; drafts 4, 7, 2019-09, 2020-12 [V] | No eval (inferred from Workers support) [V-inferred]; still regex ReDoS | n/a | MIT [U] | Good if JSON Schema is ever needed at runtime |
| `@valibot/to-json-schema` | Valibot schema to JSON Schema (draft-07) [V]; `errorMode` throw/warn/ignore; transforms have no JSON Schema equivalent [V] | v1.3.0 [V]; actively extended (`typeMode`, overrides, global defs) [V] | Pure data out | n/a | MIT [U] | **Use for export only** (MCP/AI tool schemas) |
| Payload CMS fields | Code-defined fields (Array, Blocks, JSON, Select, Relationship…) [V] | Established | n/a | n/a (React admin) | MIT [U] | Reference for field vocab; developer-time, not runtime |
| Contentful | Content types with field ids; deletion is two-step (omit, then delete) [V] | Established | n/a | n/a | Proprietary | **Copy the soft-delete step** |
| Keystatic / TinaCMS | Code-defined schema, git/markdown-backed [U] | Established-ish | n/a | n/a | MIT [U] | Not runtime-editable; low relevance |
| Tana supertags | Node-level "supertag" defines fields; any node can gain fields ad hoc [U] | Commercial | n/a | n/a | Proprietary | UX reference for "add a field inline" |
| Yjs | CRDT, ~27.5 kB gzip (bundlephobia, v13.6.33) [S] | Very established | n/a | Framework-agnostic | MIT [U] | Not justified for MVP |
| Automerge 2 | CRDT, Rust/WASM core [U] | Established | n/a | Framework-agnostic | MIT [U] | Not justified for MVP |
| CBOR / MessagePack | Binary JSON-like encodings | RFC 8949 (CBOR) is a standard [U text]; msgpack spec stable | Decoder hardening needed | n/a | n/a | Not justified (see §6) |

### 2. Data-model prior art

#### Notion [V]
- Property object: `{ id, name, description, type, <type>: {config} }`. "A property's `id` stays the same
  when its name changes." The title property always has id `title`. Ids are URL-encoded in responses.
- Types include checkbox, date, email, files, formula, multi_select, number, people, phone_number,
  relation, rich_text, rollup, select, status, title, unique_id, url; computed types (formula, rollup,
  created/edited) are read-only.
- Select options: names unique case-insensitively, no commas.
- Since API version `2025-09-03`, schemas belong to *data sources*, not databases: evidence that even
  Notion moved its schema boundary once. Keep the definition/instance boundary explicit.
- Notion's schema is **shared per database** (not inline per page). v10r's inline design is closer to a
  free-form "property bag"; the id/name/type/config shape still transfers directly.

#### Airtable [V]
- 32 field types; field ids look like `fldXXXXXXXXXXXXXX`; formulas store ids, UI shows names.
- Select **options have their own ids**; writing an unknown option name fails unless `typecast`.
  Lesson: give select options stable ids, or a rename of an option silently orphans stored values.
- Multi-select update replaces the whole array (no element-level patch).

#### Baserow [V] / Directus [V] / NocoDB [U]
- Baserow: a real Postgres table per user table, a real column `field_{id}` per field. Columns are
  named by **id**, never by label (same lesson as Notion).
- Directus: "fields are database columns with additional metadata"; "alias" fields have no column.
- These are **runtime-DDL** systems: they `ALTER TABLE` on user action. That fits shared schemas across
  many rows, but it costs migrations, locks and a privileged DB role. It is the wrong fit for inline,
  per-record attributes.
- Licensing: Baserow core MIT; Directus v12 "Monospace Sustainable Core License", source-available and
  GPLv3 after 4 years (previously BSL with a $5M grant) [V]. Neither is something to embed; both are
  only architecture references.

#### Contentful [V]
- Two-step field deletion: mark the field "omitted" (reversible: it disappears from responses), then
  delete permanently. A cheap, valuable UX/safety pattern for "remove attribute".

#### Payload CMS [V]
- Rich field vocabulary (Array, Blocks, Group, JSON, Relationship, Select, Upload…) defined in TS
  config; "presentational" and "virtual" fields are separated from data fields. Useful taxonomy:
  v10r's attribute kinds are *data* kinds; layout/grouping is a separate concern.

### 3. Form generators

#### Form.io [V]
- Definitions embed **JavaScript strings** (custom conditionals, calculated values, custom validation).
  Form.io itself ships a "Protected Evaluator" (`@formio/protected-eval`, based on JS-Interpreter) so
  that owners can sandbox "unsafe, user-supplied code". The existence of that plugin is the warning.
- CVE-2020-28246 (`formio`): server-side template injection leading to RCE; NVD 9.8; the vendor disputes
  it (sandboxed, admin-only); Snyk lists no fixed version and says the default template service was
  removed after 2020.
- Verdict: never accept code-as-data. If v10r ever needs conditions, use a closed, declarative
  operator set (e.g. `{ when: attrId, equals: value }`) evaluated by a tiny interpreter.

#### JSON Forms [V]
- JSON Schema (data) + UI Schema (layout) separation; renderer sets for React (Material, Vanilla),
  Angular (Material) and Vue 3 (Vanilla, Vuetify). **No Svelte renderer set.** Validation via Ajv.

#### SurveyJS [V]
- Only the *Form Library* (the renderer) is MIT. The *Survey Creator* (the builder UI, which is the
  part matching "user adds attributes") requires a paid developer license per team member.

#### react-jsonschema-form [V]
- Very active (v6.11.1 on 2026-11-05) but React-only.

#### svelte-jsonschema-form (`@sjsf/form`) [V]
- Svelte 5 native; MIT AND Apache-2.0 (contains modified rjsf code). Validators: Ajv8, cfworker,
  schemasafe, **Valibot**, Zod4. Current line 3.3.x [S, ecosyste.ms]; ~170 GitHub stars: one maintainer,
  small community (bus-factor risk).
- It *renders* a schema; the v10r pattern's core is *editing the schema itself* inline with values.
  Adopting it would add a JSON Schema layer, a theme package and a validator adapter just to render
  eight simple kinds, while v10r already has its own component library (component-first rule).

### 4. Validators: JSON Schema vs Valibot

- **Ajv** [V]: compiles schemas with code generation. In browsers it needs CSP `'unsafe-eval'`
  ("not recommended", enables XSS) unless schemas are **precompiled at build time** (standalone code).
  User-authored schemas are by definition runtime, so precompiling is impossible. Ajv's own docs say
  schemas must be "trusted as your application code": untrusted ones can cause stack overflow and slow
  compilation, and `pattern`/`patternProperties` risk ReDoS. Mitigations: `code: { regExp: RE2 }`
  (changes regex semantics, no look-aheads), `maxLength`, no `allErrors` in production.
- **@cfworker/json-schema** [V]: interpreting validator (exists because Workers lack the APIs Ajv
  compilation needs), supports 2020-12, 113 kB unpacked. The safe choice *if* JSON Schema is required at
  runtime.
- **`@valibot/to-json-schema`** [V]: Valibot to JSON Schema **draft-07**; `errorMode`
  `'throw' | 'warn' | 'ignore'`; transformations "have no equivalent in JSON schema". Recent additions:
  `typeMode` (input/output), `overrideSchema/Action/Ref`, `addGlobalDefs`, `toJsonSchemaDefs`. No
  documented `fromJsonSchema` [V: not mentioned]. Good for *exporting* the attribute document shape (for
  MCP tools, AI tool schemas, OpenAPI), not as a runtime engine for user schemas.
- **Key design point**: the user-authored "schema" here is a closed vocabulary of 8 kinds plus a few
  options (required, min/max, options, maxLength). That is not arbitrary JSON Schema. A fixed Valibot
  *variant over `kind`* validates both the definition and the value with no code generation, no
  user regex, and server/client parity. Build-time Valibot schemas are trusted application code.

### 5. Storage: JSONB vs EAV in PostgreSQL

#### JSONB semantics [V, PostgreSQL docs]
- `jsonb` "does not preserve white space, does not preserve the order of object keys, and does not keep
  duplicate object keys. If duplicate keys are specified in the input, only the last value is kept."
  Short keys are stored before longer ones.
  - Consequence 1: **attribute order cannot live in object key order.** Store attributes as an
    **array** (order = array index), or carry an explicit `position`.
  - Consequence 2: a duplicate-key payload is silently collapsed on the server (last wins), while the
    client may have used the first one. Validate uniqueness of attribute ids *before* insert. Never rely on
    `jsonb` to reject duplicates.
- `jsonb` rejects numbers outside `numeric` range, `\u0000`, and NaN/Infinity. Validate numbers as finite
  and strip NUL in the domain, or the insert fails late with a DB error.
- Docs: "any update acquires a row-level lock on the whole row. Consider limiting JSON documents to a
  manageable size."
- Size: no numeric jsonb limit in the datatype page [V]; ~255 MB per jsonb value is a commonly cited
  implementation limit (JEntry offset bits) [S]; general field limit 1 GB [U]. Irrelevant at our scale;
  set an application cap (e.g. ≤ 200 attributes, ≤ 64 kB document).

#### Indexing [V]
- GIN `jsonb_ops` (default): supports `?`, `?|`, `?&`, `@>`, `@?`, `@@`; one index entry per key *and*
  value.
- GIN `jsonb_path_ops`: supports `@>`, `@?`, `@@` only (no key-exists), entries per value; "usually much
  smaller… specificity of searches is better"; no entries for empty structures such as `{"a": {}}`.
- With an **array of attributes** (`[{id,label,kind,value}]`), containment queries like
  `attributes @> '[{"label":"Color","value":"red"}]'` work with `jsonb_path_ops`. Hot, known attributes are
  better served by an **expression index** or a generated column (btree) on a specific path.

#### TOAST and rewrites [S, pganalyze 2022]
- Values larger than ~2 kB get compressed or moved out of line (TOAST); reads of TOASTed jsonb are
  markedly slower; **any update duplicates the whole TOASTed value** (WAL + bloat). Partial-update patches
  for TOAST were proposed (PG15 era), not merged as of that source.
- MVCC: every UPDATE writes a new row version anyway [U, standard PG behavior]. Small documents (well under
  2 kB, typical for a handful of attributes) avoid the TOAST cliff entirely.

#### EAV
- EAV (`record_id, attribute_id, value_text/value_num/...`) gives per-attribute rows, typed columns and
  FK references. Costs: N-way self-joins or pivots to rebuild a record, loss of per-type constraints
  unless one column per type exists, many rows per record, harder atomic "save whole record"
  [U, well-known trade-offs].
- Systems that need shared schemas at scale (Baserow, Directus) chose neither: they chose **real columns
  via runtime DDL**. EAV appears mostly in legacy commerce platforms (e.g. Magento) [U].
- For *inline, per-record, small* attribute sets that load and save as one unit, **JSONB is the
  established fit.** Use EAV or relational columns only for attributes that must be referentially
  enforced or heavily queried across records; promote those to real columns.
- "reference" kind: a JSONB value cannot carry a FK. Either validate existence in the domain on write
  and tolerate dangling refs on read, or mirror refs into a side table (`record_reference`) with real
  FKs [design option, not a library fact].

### 6. Binary formats (CBOR, MessagePack)

- CBOR is RFC 8949 (2020) [U text]; §4.2 defines "deterministic encoding" (preferred/shortest
  serialization, definite lengths, map keys sorted bytewise by encoded form) [U, search hits on dCBOR /
  CBOR-core drafts confirm active follow-up work]. MessagePack has a stable spec, no deterministic profile
  [U].
- cbor-x's own benchmark (author-run, unspecified dataset) [S]: JSON encode 16.4k ops/s vs cbor-x 32.3k;
  decode JSON 17.7k vs cbor-x 18.9k (75k with "shared structures"); @msgpack/msgpack decode 14.2k (slower
  than JSON.parse). The gains come mainly from record/shared-structure extensions, not plain CBOR.
- For small documents (≤ a few kB) over HTTP with gzip/brotli: size differences shrink to near zero
  after compression, V8 `JSON.parse` is highly optimized, and **Postgres stores jsonb, not CBOR**, so a
  binary wire format adds an encode/decode hop at each end plus a dependency. DevTools, logs and
  SvelteKit form actions are JSON-native. **No measurable benefit for the MVP** (claim based on the
  above, not a v10r-specific benchmark).
- If byte-stable hashing is ever needed (signatures, dedup), **RFC 8785 JSON Canonicalization Scheme**
  [U] keeps JSON and gives determinism without a binary format.

### 7. Schema evolution

- **Stable ids vs labels** (Notion [V], Airtable [V], Baserow `field_{id}` [V]): every production system
  keys by an immutable id and treats the label as mutable display text. Renames are then free, and
  values survive. Select options need ids too (Airtable [V]).
- **Cambria** (Ink & Switch, 2020) [V]: bidirectional lenses (rename, convert, wrap, head, add, remove,
  in, hoist) over JSON Patch, translate-on-read through a graph of schemas. Explicitly a **research
  prototype**, not production-quality; limitations: lossy changes, no recursion, no cross-document,
  unmeasured performance. Experimental; take the *idea*, not the library.
- **Versioned documents + upcasters** (event-sourcing practice) [U, established practice]: store
  `schemaVersion` in the document; on read, run pure `v1→v2→v3` functions in the domain; write back at
  the latest version. Simple, testable, no dependency. Fits "no backward compatibility" during
  development (a one-off rewrite script is equally valid), while keeping the pattern honest for
  adopters.
- **Kind change** of an attribute (text→number) is a lossy convert: either forbid it or require an
  explicit, validated conversion with a "value cleared" warning (Cambria's `convert` caveat applies).

### 8. Concurrency and patches

- **Optimistic concurrency** [U text of RFC 9110, established]: a `version` integer (or ETag) per record;
  the client sends `If-Match` (or the version in the form body); the server does
  `UPDATE … WHERE id = $1 AND version = $2` and on 0 rows returns **412 Precondition Failed** (REST) or a
  `fail(409, …)`-style conflict in a form action. Cheapest correct answer for single-author or
  low-contention editing.
- **JSON Patch, RFC 6902** [U]: ordered ops (`add`, `remove`, `replace`, `move`, `copy`, `test`) with JSON
  Pointer paths; `test` gives per-path preconditions; array index paths are fragile under concurrent
  reorders. Using attribute ids (not indices) requires id-to-index resolution.
- **JSON Merge Patch, RFC 7386** [U]: object-merge semantics, `null` means delete (cannot set a value to
  `null`), arrays replaced wholesale. With attributes as an array, merge patch degenerates to
  "replace all": fine for whole-document save.
- **CRDTs**: Yjs ~27.5 kB gzip [S]; Automerge 2 is a Rust/WASM core (larger, async init) [U]. Worth it
  only for real-time multi-user co-editing or offline-first sync; they need a sync server/provider and a
  binary document format (stored as `bytea`, not queryable jsonb). **Not justified for the MVP**;
  whole-document save + version check + clear conflict UX covers the stated use case.

### 9. Security checklist (parsing and user input)

- **Prototype pollution** [V, fastify/secure-json-parse]: `JSON.parse` creates `__proto__` as an *own*
  property ("by itself… not a security issue"); the danger arises on `Object.assign` / spread / deep-merge
  / iteration-copy, where it becomes the prototype. `secure-json-parse` offers `protoAction` /
  `constructorAction` (`error` | `remove` | `ignore`).
  - v10r mitigation without a dependency: attributes are an **array of objects with fixed keys** validated
    by a strict Valibot `object` (unknown keys rejected or stripped), user text lives only in *values*
    and *labels*, never in object *keys*. Reject attribute ids/keys equal to `__proto__`, `constructor`,
    `prototype` via an id regex like `^[a-z0-9_-]{1,32}$` or generated ids. If a lookup map is needed,
    use `Map` or `Object.create(null)`.
- **ReDoS** [V, Ajv security doc]: do **not** offer user-supplied regex patterns in the MVP. If required
  later: length-cap the pattern, compile with a linear-time engine (RE2 / `re2js`) [U for re2js], or offer
  predefined formats (email, url) instead. Cap `maxLength` on all strings regardless.
- **No code in data** (Form.io lesson [V]): no expressions, templates or formulas evaluated from stored
  definitions.
- **Size caps**: attribute count, label length, value length, list length, total document bytes. Bounds
  also protect the TOAST threshold and the row lock duration [V, PG docs].
- **XSS**: render labels/values as text (Svelte escapes by default); never `{@html}` for multiline values.
- **CSP**: avoid any validator needing `unsafe-eval` (Ajv runtime compile) [V].

### 10. Lessons for v10r

1. **Build on Valibot; adopt no form/schema library.** The attribute vocabulary is closed (8 kinds); one
   Valibot variant over `kind` validates definitions and values on server and client, with no codegen,
   no CSP issue and no new dependency. Export with `@valibot/to-json-schema` (draft-07) where an external
   contract needs JSON Schema (MCP/AI tools). Re-evaluate `@sjsf/form` only if a future pattern renders
   *arbitrary external* JSON Schemas.
2. **Shape: Notion's property object, stored inline.** `{ id, label, kind, config, value }` in an
   **ordered array** under a versioned envelope `{ schemaVersion, attributes: [...] }`. Immutable
   generated `id`; mutable `label`; select options with their own ids.
3. **JSONB, not EAV**, for inline, per-record, load-and-save-as-a-unit attributes. Default GIN
   `jsonb_path_ops` only when cross-record containment search is a real requirement; promote hot
   attributes to expression indexes or real columns. Keep documents small (cap) to stay under TOAST.
4. **Order lives in the array**, never in object keys (jsonb reorders keys and drops duplicates,
   last-wins [V]).
5. **Validate before Postgres**: unique ids, finite numbers, no `\u0000`, length caps, strict objects
   (prototype-pollution-safe keys).
6. **Optimistic concurrency** via a `version` column: 412 for the REST surface, a form `fail` for the page
   surface. Whole-document replace on save (Merge-Patch-equivalent); JSON Patch only if granular sync is
   needed later.
7. **Evolution**: `schemaVersion` + pure upcasters in the domain; Cambria as inspiration only
   (research-grade).
8. **Removal UX**: Contentful-style two-step (hide/"omitted", then delete) or undo; kind changes are
   explicit lossy conversions.
9. **Not for MVP**: CBOR/MessagePack (no measurable benefit for small, gzip'd, jsonb-stored documents),
   CRDTs (only for real-time co-editing or offline-first), user regex, any expression language.
10. **Reference kind**: domain-validated id + optional side table with real FKs if integrity matters;
    jsonb cannot enforce FKs.

### Where the implementation departed from these lessons

- The envelope field is `format`, not `schemaVersion`: in v10r *version* is the stored
  record's optimistic-concurrency counter and *revision* a stored pre-image, so the shape
  number needed its own word.
- Seven core kinds, not eight: `reference` was left for later (it needs a domain to validate
  against), and the registry is open, so an application adds its own kinds.
- Removal is a bounded in-record trash (`removed`, restorable in place) plus undo, rather than
  Contentful's two-step omit-then-delete.
- A type change never clears a value: what does not convert exactly is kept in `previous`.
- Conflicts can be merged, not only detected: a three-way merge by attribute id, offered as a
  button, because attribute ids make most concurrent edits disjoint.
- The REST surface answers a stale save with `409 version_conflict` (the desk's existing
  contract), not `412`.

### 11. References

- Notion property object: https://developers.notion.com/reference/property-object
- Notion working with databases: https://developers.notion.com/docs/working-with-databases
- Airtable field model: https://airtable.com/developers/web/api/field-model
- Baserow database plugin (table/field storage): https://baserow.io/docs/technical%2Fdatabase-plugin
- Baserow repository mirror (license note): https://github.com/dldinternet/baserow
- Directus fields: https://directus.com/docs/guides/data-model/fields
- Directus v12 license change: https://directus.com/resources/directus-v12-license-change
- Contentful field deletion: https://www.contentful.com/developers/changelog/field-deletion/
- Payload CMS fields overview: https://payloadcms.com/docs/v3/fields/overview.md
- Form.io protected evaluator: https://help.form.io/dev/javascript-evaluator/protected-evaluator
- `@formio/protected-eval`: https://www.npmjs.com/package/@formio/protected-eval
- CVE-2020-28246 (Snyk): https://security.snyk.io/vuln/SNYK-JS-FORMIO-2859219
- JSON Forms intro: https://www.mintlify.com/eclipsesource/jsonforms/introduction
- SurveyJS licensing: https://surveyjs.io/Licenses
- rjsf releases: https://releasealert.dev/github/rjsf-team/react-jsonschema-form
- svelte-jsonschema-form: https://github.com/x0k/svelte-jsonschema-form
- `@sjsf` packages: https://packages.ecosyste.ms/registries/npmjs.org/namespaces/sjsf
- `@sjsf/form` on npm: https://npmjs.com/package/@sjsf/form
- Ajv security considerations: https://ajv.js.org/security.html
- `@cfworker/json-schema`: https://www.npmjs.com/package/@cfworker/json-schema
- `@valibot/to-json-schema`: https://npmjs.com/package/@valibot/to-json-schema
- Valibot JSON Schema package upgrade: https://valibot.dev/blog/json-schema-package-upgrade/
- PostgreSQL JSON types: https://www.postgresql.org/docs/current/datatype-json.html
- pganalyze, JSONB and TOAST: https://pganalyze.com/blog/5mins-postgres-jsonb-toast
- cbor-x benchmark: https://deno.land/x/cbor@v1.5.9/benchmark.md
- dCBOR draft (deterministic CBOR follow-up): https://datatracker.ietf.org/doc/html/draft-mcnally-deterministic-cbor-05
- RFC 8949 CBOR [U, not fetched]: https://www.rfc-editor.org/rfc/rfc8949
- RFC 6902 JSON Patch [U]: https://www.rfc-editor.org/rfc/rfc6902
- RFC 7386 JSON Merge Patch [U]: https://www.rfc-editor.org/rfc/rfc7386
- RFC 8785 JSON Canonicalization [U]: https://www.rfc-editor.org/rfc/rfc8785
- RFC 9110 HTTP Semantics (If-Match, 412) [U]: https://www.rfc-editor.org/rfc/rfc9110
- Cambria: https://inkandswitch.com/cambria
- Cambria thesis (MIT): https://dspace.mit.edu/handle/1721.1/145983
- Yjs vs Automerge vs Loro sizes: https://pkgpulse.com/compare/yjs-vs-automerge-vs-loro
- secure-json-parse: https://github.com/fastify/secure-json-parse
