# Derivation

Most stored data in an application is derived: chunks and embeddings from documents, generated
pages from a registry, a wasm binary from a crate. Every derived output carries the same three
questions. Is it still current? Can it be rebuilt and checked? Where did it come from? Each
section below answers one of them.

## Derivation key

**Problem.** A content hash tells you the input bytes have not changed. It cannot tell you
that the code reading them has. When the chunker changes, every document hash stays
identical and every stored chunk goes stale. v10r's docs ingest used to skip on content hash
alone, so a chunking change needed someone to remember `--force`. When nobody did, the
assistant answered from chunks the current code would never produce.

**Method.** Store a key beside every derived output:

```ts
derivationKey(transform, inputs)   // src/lib/server/db/content-hash.ts
// = contentHash(JSON.stringify([transform, ...inputs]))
```

- `transform` names the producing code and its version: `docs-ingest@1`,
  `retrieval-ingest@1`. Bump it when that code changes what it writes.
- `inputs` lists everything else that changes the output, in a fixed order: the source's
  content hash, the chunker's `chunkingInput()` (logic version plus sizing), the embedding
  model, and the context model that wrote the prefixes (or `no-context-model`).
- The output is current exactly while a recomputed key equals the stored one. A null key
  (derived before keys existed) never matches, so such an output re-derives once.

**Where it runs.**

| Derivation | Transform | Reader that skips on a match |
|---|---|---|
| Docs corpus (`scripts/db/ingest-docs.ts`) | `docs-ingest@N` | Per file. An unchanged corpus costs zero embeds, and a run cut short by the embed quota resumes where it stopped |
| Desk files (`retrieval/ingest/index.ts` → `ingestIfChanged`) | `retrieval-ingest@N` | `syncDeskFileToRetrieval`, offered every pinned file by the daily `desk-retrieval-sync`. Unchanged inputs keep their embeddings and the copy is re-stamped current; a chunker or model bump re-derives every copy. Only a `ready` copy's key counts, because an errored ingest stored its key too |

**Keeping the version honest.** A version constant is only as good as the discipline of
bumping it. So `plan.test.ts` pins a fingerprint of the chunker's *output* on a fixture next
to `CHUNKER_VERSION`. If the planner's behaviour changes, the test fails, and whoever changed
it has to decide: bump the version (and re-derive every corpus) or show the change is
output-neutral. Hashing the chunker's source code instead was rejected. A comment edit would
re-embed the whole corpus and use up the day's embedding quota.

**Graphs, briefly.** Selective recomputation across a dependency graph uses the same key
applied per node: a node is dirty when its key moves, and its dependents re-key on the new
output. v10r has two small graphs and needs no general engine. The spreadsheet resolver
(`src/lib/desk/formula.ts`) memoises per pass and reports cycles as `#CIRC!`. `topoSort` in
`pattern-library/schema.ts` orders the registry's `depends_on` deterministically, and
`patterns:validate` fails on a cycle.

**Invariants.**

- Every input that changes the output is either listed in `inputs` or covered by the
  transform version. An undeclared input is the one way the key lies.
- The key is written in the same insert as the output it describes.
- A missing key means stale, never fresh.
- Exactly one place builds each shared input (`chunkingInput()`, `EMBEDDING_INPUT`), so two
  producers of the same derivation cannot key it differently.
- Only a successfully derived output's key counts. A failed derivation that stored its key
  must not satisfy the next comparison.

**Do not use** when a full rebuild is cheap and nothing reads a stale output in between, as
with the pattern pages, which are regenerated from scratch on every build. A key there would
only add bookkeeping.

## Reproducible artifact build

**Problem.** Some outputs are committed to the repository: generated docs, a snapshot of
MCP excerpts, a wasm binary. A committed artifact has to stay provably in step with its
sources. "Run the generator before you commit" is prose, and prose drifts.

**Method.** The proof depends on whether the gate can run the generator:

| Case | Proof | v10r instance |
|---|---|---|
| The generator runs in the gate (deterministic, cheap, no network) | **Regenerate and diff.** `--check` rebuilds in memory and fails on any byte difference, any missing output, or any orphan | `patterns:check` (README index plus one page per record, with orphan pages detected), `mcp:excerpts:check` (single snapshot file, byte-compared) |
| The generator cannot run in the gate (a Rust toolchain in a pinned container) | **Manifest plus digest recheck.** The build writes the sha256 of every input and output plus the toolchain identity; the gate recomputes the digests | `scripts/wasm/build.sh` → `src/lib/wasm/kernel/build-manifest.json` (image pinned by `@sha256`, `wasm-bindgen` version, inputs, outputs) checked by `kernel-manifest.test.ts` |
| The output depends on the build environment (bundle size) | **Attested snapshot.** The record carries what is needed to reproduce it, and the gate refuses one without it | `perf/snapshot.json` must carry `gitSha` and `NODE_ENV=production` (`snapshot.gate.test.ts`) |

The manifest follows the shape of SLSA provenance (`buildType`, resolved dependencies with
digests, subjects with digests), unsigned. Signing and SLSA build levels only matter when a
third party verifies the artifact. Wall-clock time stays out of manifests, so the manifest is
itself reproducible.

**Bit-for-bit vs input-addressed.** The pattern pages are bit-for-bit reproducible: the same
registry always gives the same bytes. The wasm manifest proves something weaker. The files
present now match the files hashed at build time. It does not prove that a rebuild would
produce the same binary. `kernel-manifest.test.ts` says so in its own header. Outputs of
non-deterministic transforms, such as embeddings and LLM context prefixes, are
**input-addressed**: their derivation key proves which inputs produced them, never that a
rerun would match. Label each artifact with the kind of proof it actually has.

**Invariants.**

- A committed artifact is checked by the gate. A generator with no check is an unbound mirror.
- `--check` fails on missing and orphaned outputs, not only on changed bytes.
- Generators read neither the clock nor the network, and iterate in a declared order.
- A manifest's toolchain identity is pinned by digest, not by tag.

**Do not use** for outputs that are never committed and are rebuilt on every deploy (the
SvelteKit build itself), where the deploy *is* the regeneration.

## Provenance record

**Problem.** "Where did this come from?" covers several questions. Which input was it derived
from? Which activity produced it? Was that a person or a model, and on whose behalf? Without
a common shape, every feature invents its own half-answer, and the halves do not line up.

**Method.** Use the core of W3C PROV-DM and nothing more: an **entity** (the thing, pinned to
a revision or content hash, never to a mutable id alone), an **activity** (what produced it,
with its transform version), and an **agent** (`human`, `software` or `ai`, plus on whose
behalf). Three relations carry it: *generated by*, *derived from*, and *attributed to*.
OpenLineage is pipeline-level and full PROV-O/RDF exists for exchange between organisations;
both are overkill for an application.

| v10r instance | Entity pinned by | Activity / transform | Agent |
|---|---|---|---|
| `blog.revision` + `blog.published_revision` | immutable revision row + `contentHash` | publish | author user id |
| `retrieval.document` / `chunk` | `contentHash` + `derivationKey` | `docs-ingest@N` / `retrieval-ingest@N` | system or owning user |
| `image_metadata.fieldProvenance` | per field | AI proposal vs human edit | `ai-draft` / `human`, plus `approvedBy` |
| `desk.file_revision` | pre-image row | the overwrite that replaced it | `source: ai \| user` |
| `TurnTrace` (`ai.turn`, `model_call`) | `profileVersion`, provider + model ids | one assistant turn | the model, on behalf of the user |
| `admin.audit_log` | before/after in `detail` | privileged action | admin user id |
| `build-manifest.json` | input and output sha256 | `build.sh` with a pinned image | the build |

`provenance` is also the name of `TurnProvenance` (`authored` / `recorded` / `live`). That is
one instance of the same concept: where a shown turn came from. It is not a second meaning.

**Invariants.**

- Provenance points at a revision or a content hash, never only at a mutable id. Otherwise it
  dangles after the next edit.
- AI and human authorship are distinguished at the field or row where they differ.
- Agent references are personal data, so each trail decides explicitly what happens on
  account erasure, and the schema states the decision. v10r uses all three answers:
  `desk.file_revision` cascades with its user, `blog.revision.author_id` is set to null (the
  revision outlives its author), and `admin.audit_log.actor_id` deliberately has no foreign
  key, so the record of a privileged action survives the account that took it.
- Provenance is append-only. A correction is a new record, not an edit of the old one.

**Do not use** for data with one author and no derivation, such as a user's own settings row,
where the row is its own provenance.
