# Dynamic Attributes — self-describing records

A record that starts almost empty and grows the attributes its user names. Each attribute is
a label, a type and a value, and the definitions travel **inside** the record, beside the
values: no template, no schema table, no migration when a user invents a field. Renaming
keeps the value, changing a type keeps what does not convert, removing is undoable, and two
writers who change the same record at once get a visible conflict they can merge by attribute.

**Page:** `/showcases/dynamic-attributes` · **Desk:** Explorer → *New Record* ·
**Core:** `src/lib/dynamic-attributes/` · **Editor:** `src/lib/components/composites/attributes/` ·
**Persistence:** `desk.record` (`src/lib/server/db/schema/desk/record.ts`),
`PUT /api/desk/files/[id]` · **Research:** [research.md](./research.md) · **Plan:** [plan.md](./plan.md)

## The problem it solves

An asset panel, a character sheet, a supplier contact, a lab sample: each describes one thing
with facts nobody could list in advance. A fixed form forces every fact into a column someone
had to plan; a free-text field loses the types. The pattern sits between them: the user adds
`Species | Human`, `Age | 32`, `Last service | 2026-10-01` as they go, each attribute typed, and
the application never has to know those words.

What it deliberately is not: a form builder, a spreadsheet, or a database designer. There are
no formulas, no conditions, no cross-record schema and no user-supplied code of any kind.

## When to use it — and when not

Use it when:

- the set of facts differs from one record to the next and is owned by the person writing it;
- a record loads and saves as one unit (a panel, a dialog, a settings page);
- the facts need types (numbers that sort, dates that parse, choices from a list) but not
  cross-record integrity.

Avoid it when:

- every record has the same fields — a Valibot schema and a form are simpler and queryable;
- an attribute must be a foreign key, unique across records or indexed for search — promote it
  to a real column (see *Limitations*);
- two people must type into the same value at once — that is the CRDT case, not this one;
- the "attributes" carry behaviour (validation scripts, formulas, conditional visibility) —
  that is a rule engine, and this pattern refuses code-as-data by design.

## The record model

```jsonc
{
  "format": 1,                       // persisted shape; a newer one is refused, an older one upcast
  "attributes": [                    // order is the array order — never object-key order
    {
      "id": "att_3f9c0a12b4",        // stable identity, minted once, never reused
      "label": "Species",            // display text; free to change
      "kind": "select",              // an id in the kind registry
      "config": { "options": [{ "id": "human", "label": "Human" }] },
      "value": "human",
      "previous": {                  // only after a lossy type change
        "kind": "text", "value": "Human-ish", "config": {}
      }
    }
  ],
  "removed": [                       // bounded trash: restorable in place
    { "attribute": { "id": "att_…", "label": "Age", "kind": "number", "value": 32, "config": {} }, "index": 1 }
  ]
}
```

Five decisions carry the pattern, each borrowed from systems that learned it the hard way
([research.md](./research.md)):

1. **Identity is an id, never a label.** Notion, Airtable and Baserow all key fields by an
   immutable id. A rename is a label edit; a value cannot be orphaned by it, and duplicate
   labels are a *diagnostic*, not an error.
2. **Definitions live with values.** A record is readable on its own — by another app, a
   backup restore or the AI assistant — without a template that may have moved on.
3. **Order is an array.** PostgreSQL `jsonb` does not keep object-key order and keeps only the
   last duplicate key, so neither can carry meaning.
4. **Choices have ids too.** A select option's label can change; the stored value is the
   option id (Airtable's lesson).
5. **Nothing is lost silently.** A lossy type change keeps the old value in `previous`; a
   removal goes to `removed`; a value of a kind this build does not know is kept, opaque and
   read-only; a record from a newer format is refused rather than downgraded.

Vocabulary (also in `docs/naming.md`): **attribute** (one labelled, typed value), **attribute
kind** (`kind`, a registry id), **self-describing record** (`AttributeRecord`), **format** (the
persisted shape number), **version** (the optimistic-concurrency counter of a stored record),
**revision** (a stored pre-image, the desk's existing term).

## Architecture

```
#lib/dynamic-attributes/            framework-free core — browser, server and tests alike
  json.ts         bounded plain-JSON copy, canonical serialization, reserved keys
  limits.ts       every bound in one object (DEFAULT_ATTRIBUTE_LIMITS)
  kinds.ts        AttributeKind contract, registry, the seven core kinds
  record.ts       the types, ATTRIBUTE_RECORD_FORMAT, id minting
  codec.ts        unknown → AttributeRecord or problems; upcasters; serialize
  operations.ts   the engine: add, relabel, set, configure, change kind, move, remove, restore…
  diagnostics.ts  soft findings that never block a save
  merge.ts        three-way merge by attribute id
  projection.ts   label: value text, for search and the assistant
  stores.ts       AttributeRecordStore contract + a key-value store over any Storage

#lib/state/                         generic over any document kind (lifted from the spreadsheet)
  document-autosave.ts   debounced, serialized saves; conflict state; rebase(resolve)
  document-drafts.ts     one device draft slot per writer
  document-sessions.ts   per-tab session registry + unsaved work at sign-out

#lib/components/composites/attributes/         Svelte 5 renderer
  attribute-editor.svelte.ts   $state.raw record, undo/redo with coalescing, refusal, diagnostics
  record-session.svelte.ts     editor + document autosave over any AttributeRecordStore + merge
  AttributeEditor.svelte, AttributeRow.svelte, RecordSaveStatus.svelte
  controls.ts + controls/      one control per kind; the map is the extension point

desk integration                    adapters only
  db/schema/desk/record.ts     desk.record detail table (document jsonb, version)
  db/desk/mutations.ts         createRecordFile, updateRecordByFileId (parse → lock → version check → revision)
  api/desk/files/[id]          GET record, PUT { document, expectedVersion } → 200 / 409 / 422 / 413
  components/desk/panels/record/   RecordPanel, HTTP store, session registry
```

The layering follows the repo's invariants (`src/lib/architecture.gate.test.ts`): the core has
no framework import; the server parses with the same codec the browser uses; HTTP status
codes exist only in the route adapter.

## Contracts

### Kinds — `AttributeKind`

```ts
interface AttributeKind {
  id: string;                                       // /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, ≤ 40
  defaultConfig(): JsonObject;
  parseConfig(input: unknown, limits): JsonObject | undefined;     // undefined = refused
  accepts(value: JsonValue, config, limits): boolean;
  empty(config): JsonValue;
  text(value, config): string;                      // the one projection every kind has
  fromText(text, config, limits): JsonValue | undefined;          // the conversion path
  configFromText?(texts: string[], limits): JsonObject;           // e.g. select options from old values
  check?(value, config): AttributeValueFinding[];   // soft: below_min, above_max, not_integer, unknown_option
}
```

Core kinds: `text`, `multiline`, `number` (`min`, `max`, `integer`), `boolean`, `date`
(`YYYY-MM-DD`, calendar-checked), `select` (options with ids), `list` (strings). A registry
(`createAttributeKindRegistry`) refuses a duplicate or malformed id at construction.

**Type change** goes through text: `next.fromText(previous.text(value))`. The conversion is
*exact* when the result reads back as the same text; otherwise the old value, kind and config
are kept in `previous` until the user restores or discards them. Changing back to the
previous kind restores it outright.

### Codec — `parseAttributeRecord(input, { kinds, limits?, upcasters?, format? })`

Returns `{ ok: true, record }` or `{ ok: false, problems: [{ code, path, message }] }`, never
throws. Order of checks:

1. `parseAttributeRecordText` checks the byte length **before** `JSON.parse`.
2. A bounded copy of the whole payload into fresh plain objects (`copyBoundedJson`): refuses
   reserved keys (`__proto__`, `constructor`, `prototype`), `U+0000`, non-plain objects,
   non-finite numbers, and depth/entry overruns.
3. `format`: missing or not an integer → `invalid_format`; greater than this build's →
   `newer_format`; older → the upcaster chain, which must land exactly on the current format.
4. Strict Valibot frames (`strictObject`): an unknown key anywhere in the frame is a problem.
5. Count limits, then per attribute: id shape, label (length, no control characters), kind
   known → `parseConfig` + `accepts`; kind unknown → bounded opaque JSON kept as is.
6. Duplicate ids across `attributes` and `removed`; finally the serialized size.

Problem codes: `invalid_json`, `too_large`, `invalid_shape`, `invalid_format`, `newer_format`,
`too_many_attributes`, `too_many_removed`, `duplicate_id`, `invalid_label`, `invalid_config`,
`invalid_value`, `invalid_opaque`. `serializeAttributeRecord` writes canonical JSON (sorted
keys), so equal records serialize byte-identically.

### Operations — `createAttributeEngine(kinds, { limits?, createId? })`

Every operation is a pure function `(record, …, engine) → { ok: true, record, attributeId } |
{ ok: false, refusal }`: `addAttribute`, `relabelAttribute`, `setAttributeValue`,
`configureAttribute`, `convertAttributeValue`, `changeAttributeKind`, `restorePreviousValue`,
`discardPreviousValue`, `moveAttribute`, `removeAttribute`, `restoreAttribute`. Refusals:
`too_many_attributes`, `too_large`, `unknown_attribute`, `unknown_kind`, `invalid_label`,
`invalid_value`, `invalid_config`, `invalid_index`, `no_previous_value`. Unchanged attributes
keep their object identity, which is what lets Svelte re-render one row of two hundred.

### Diagnostics — `checkAttributeRecord(record, kinds)`

Soft findings, shown in the row, never blocking a save: `empty_label`, `duplicate_label`
(NFKC + trim + case-fold), `unknown_kind`, `previous_value`, and each kind's own `check`.

### Merge — `mergeAttributeRecords(base, local, remote, removedLimit)`

Three-way, keyed by attribute id. Label and the typed unit (kind + value + config + previous)
merge separately, so "you renamed it, they changed the value" is no conflict at all. A real
clash keeps the local side and is reported as `{ attributeId, part: 'label' | 'value' |
'removal' }`. Remove-vs-edit keeps the attribute (work beats deletion). The side that reordered
decides the order; attributes new on either side are kept.

### Stores — `AttributeRecordStore`

```ts
interface AttributeRecordStore {
  load(): Promise<{ record: AttributeRecord; version: number }>;
  save(record: AttributeRecord, expectedVersion: number): Promise<{ status: 'saved'; version: number } | { status: 'conflict' }>;
}
```

One promise for every implementation: **a save names the version it was based on, and a
stale save changes nothing.** Implementations: `createKeyValueRecordStore(storage, key,
codec)` over `localStorage` or `memoryStorage()` (refuses, never overwrites, a stored value
it cannot parse), and the desk's HTTP store over `PUT /api/desk/files/[id]`, which the database
enforces with `SELECT … FOR UPDATE` and a version check.

### Editor and session

- `createAttributeEditor({ engine, initial, onChange?, now? })` — the record as `$state.raw`,
  undo/redo (100 steps; keystrokes on one field within 800 ms are one step), the last refusal,
  derived diagnostics. `replace(record)` takes a record from outside without entering history.
- `createRecordSession({ engine, store, drafts, delayMs? })` — the editor wired to
  `createDocumentAutosave` over any store, plus `merge()`, which rebases out of a conflict with
  `mergeAttributeRecords` and reports the clashes it settled.
- `<AttributeEditor editor engine controls? readonly? label?>` and `<RecordSaveStatus session
  snapshot downloadName>` are the only components a host needs.

## Extension interfaces

An application adds a kind in two pieces, both registered by the application, never loaded
from data:

```ts
// 1. the pure kind — engine, codec and server
const ratingKind: AttributeKind = { id: 'app.rating', /* … */ };
const kinds = createAttributeKindRegistry([...CORE_ATTRIBUTE_KINDS, ratingKind]);

// 2. the control — the editor
const controls: AttributeControls = {
  ...coreAttributeControls,
  'app.rating': { label: () => 'Rating', icon: 'i-lucide-star', component: RatingControl },
};
```

The showcase does exactly this (`src/lib/showcases/dynamic-attributes/rating-kind.ts`,
`src/lib/components/showcases/dynamic-attributes/`). A control receives `AttributeControlProps`
(`attribute`, `kind`, `limits`, `inputId`, `labelledBy`, `disabled`, `commit(value)`,
`configure(config)`); it may be lazy (`load: () => import(…)`) so a heavy control costs nothing
until a record uses it. Other extension points: `limits` (per engine), `createId` (tests,
deterministic ids), `upcasters` (format N → N + 1), and any `AttributeRecordStore`.

A record that names a kind the current build does not register keeps working: the codec
stores its value opaquely, the editor shows it read-only, and the server — which registers only
the core kinds — preserves it value for value. Kind ids with a prefix (`app.`, `pim.`) keep
application kinds from colliding with future core kinds.

## Security invariants

Each one is enforced in code and covered by a test (`codec.test.ts`,
`record-mutations.pglite.test.ts`, `server.test.ts`).

| Invariant | Where |
|---|---|
| No code in data: no `eval`, `Function`, templates, expressions, user regex or dynamic import named by data. A kind id selects a control from a map the application built; an unknown id selects the read-only fallback. | `kinds.ts`, `controls.ts` |
| Prototype pollution is impossible: the whole payload is copied into fresh plain objects; `__proto__`, `constructor`, `prototype` are refused as keys at any depth; frames are strict objects; user text never becomes a key. | `json.ts`, `codec.ts` |
| XSS: labels and values render as text (Svelte escaping); no `{@html}` anywhere in the editor; `multiline` is a `<textarea>`. | `components/composites/attributes/` |
| Bounded everything: record bytes (checked before `JSON.parse`), attribute count, label/text/list lengths, options, trash size, opaque depth and entries. The API caps the request body before reading it (413). | `limits.ts`, `codec.ts`, `[id]/+server.ts` |
| PostgreSQL-safe: no `U+0000`, no non-finite numbers, ids unique before insert (jsonb would silently keep the last duplicate key). | `json.ts`, `codec.ts` |
| Fail closed: a record the codec refuses is never stored (422), a stored record it cannot parse is never overwritten, a newer format is never downgraded. | `codec.ts`, `stores.ts`, `mutations.ts` |
| Ownership: every read and write filters by `userId`; a foreign file id is a 404, never a 403 that confirms existence. | `queries.ts`, `mutations.ts` |
| The assistant reads records (text projection) but has no tool that writes one. | `desk-read.ts`, `deskbot-retrieval.ts` |

Device drafts are plaintext in `localStorage`, like the spreadsheet's; sign-out drains pending
saves and erases them (`#lib/state/unsaved-work.ts`).

## Performance

`bun run attributes:bench` (2026-11-05, Bun 1.4.4, linux/x64 cloud container, 2000 runs per
case; medians, p95 in the script output):

| Attributes | Bytes | Parse | Serialize | Relabel (one op) | Merge | Diagnostics |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 1.0 kB | 52 µs | 13 µs | 17 µs | 123 µs | 9 µs |
| 50 | 5.1 kB | 218 µs | 64 µs | 75 µs | 722 µs | 89 µs |
| 200 (default limit) | 20.3 kB | 916 µs | 372 µs | 354 µs | 2.5 ms | 182 µs |

Reading: a keystroke at the 200-attribute limit costs about 0.4 ms of engine time — the
operation is O(n) because every operation re-checks the serialized size, the one bound that
needs the whole record. Rendering is per row: the editor's record is `$state.raw` and
unchanged attributes keep their identity, so a keyed `{#each}` re-renders only the edited row.
Storage: a record above roughly 2 kB is TOASTed by PostgreSQL, and every update rewrites the
whole value. That is acceptable for whole-document saves debounced to one per 1.5 s, and it is
why the byte cap (256 kB) exists: it bounds the rewrite and the row-lock time.

## Integration

**Desk.** `desk.file` (type `record`) + `desk.record` (detail, `document jsonb`, `version`) — the
same single-table inheritance as spreadsheets and markdown, so the Explorer, folders, rename,
move, soft delete, restore, AI-context pinning and revisions all work unchanged. Every
overwrite and every delete writes a pre-image to `desk.file_revision.document`. The panel
reuses the docking, the panel menus (Record → Add Attribute, Undo, Redo, Download JSON), the
desk bus (`ai:refresh_file` → `ai:file_refreshed`), the unsaved-work registry used at sign-out,
and the About dialog (`#lib/desk/help.ts`).

**Elsewhere.** Anything that can implement `AttributeRecordStore` can host the editor: a
settings page over a form action, an IndexedDB store, a column on another domain's table. Parse
on the server with the core kinds (or the application's registry) before writing; keep the
version check.

**Search and AI.** `attributeRecordToText` gives `label: value` lines: the panel's AI context,
the `desk_read` tool's answer, and — for a record pinned to AI context — the text the retrieval
sync indexes.

## Limitations

- No cross-record schema: two records can call the same idea `Age` and `age`. A future
  *template* (a record of definitions with empty values) would seed new records without
  binding them.
- No referential integrity or cross-record query on attribute values. Promote an attribute
  that needs either to a real column, or mirror it into a side table with real foreign keys.
- Not real-time co-editing: concurrent writers meet as a conflict and a merge, not as live
  cursors.
- The trash keeps the last 20 removals; older ones are gone (the desk's revisions still hold
  every saved state).
- Kinds are deliberately few. There is no reference, file, rich-text, formula or computed kind.
- Duplicating a record file is not offered: a copy needs fresh attribute ids, and
  sharing ids across records would make a later merge between them meaningless.

## Future work

- A `reference` kind (domain-validated id, dangling-tolerant on read) and `url`/`email` kinds
  with fixed formats — never user regex.
- Templates and "promote to column" for attributes that turn out to be universal.
- JSON Schema export of the record frame with `@valibot/to-json-schema` for external tools (MCP).
- Drag-and-drop reordering (today: buttons and Alt+Shift+↑/↓).
- Field-level history from the existing revisions.
