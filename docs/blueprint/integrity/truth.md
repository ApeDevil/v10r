# Truth

Two questions a reader of any fact needs answered: **who owns it**, and **how sure are we**.
The principle behind the first is in
[foundation/self-expressive-project.md](../../foundation/self-expressive-project.md); this
file is the method for making it executable.

## Source-of-truth gate

**Problem.** A fact recorded twice will eventually disagree with itself. The second copy is
usually there for a good reason: a client bundle cannot import the server schema, a public
page must show the policy a job enforces, a script runs without the app's bundler. "Keep them
in sync" is prose, and prose drifts.

**Method.** Every fact gets exactly one owner. Every other place that needs the fact holds
one of these, listed from cheapest to most expensive:

| Binding | How the copy stays true | v10r instance |
|---|---|---|
| **Typed** | The compiler refuses a missing or extra key | `retention-copy.ts` is typed `Record<RetentionRuleId, …>`, so a rule with no reader-facing copy does not compile |
| **Imported** | The copy *is* the owner, reached by import | `doc-filter.ts` is imported by both the `/docs` routes and `scripts/db/ingest-docs.ts`; `content-hash.ts` is the one hash used by blog, retrieval and `content:check` |
| **Generated + `--check`** | The copy is rebuilt from the owner and the gate diffs the bytes | README Pattern Index and `docs/pattern-library/` (`patterns:check`), `mcp/public-excerpts.snapshot.json` (`mcp:excerpts:check`) |
| **Drift test** | The copy is hand-held, and a test compares it to the owner | `db-enums.drift.test.ts` (client enum mirror vs `pgEnum`, member order included), `schema-filter.gate.test.ts` (`drizzle.config.ts` vs declared `pgSchema`s), `credits/registry.gate.test.ts` (credited SPDX id vs the installed package), `mcp/patterns/parity.test.ts` (stdio vs hosted tool logic) |

Two rules make a drift test trustworthy:

- **A non-empty control.** A gate that iterates over a list passes vacuously when the list is
  empty. `credits/registry.gate.test.ts` asserts each scan found entries, and
  `naming.gate.test.ts` asserts it scanned more than a thousand files.
- **Allowances that only shrink.** An exemption list is an argument for keeping something,
  not a place to hide it. `naming.gate` and `architecture.gate` fail on a *stale* allowance
  as well as on a new violation, so the list cannot outlive its reason.

**Fail closed when the owner cannot be read.** Precedence between two sources is resolved at
design time by choosing one owner, never at runtime by falling back. `loadProviderRegistry`
(`src/lib/server/ai/index.ts`) is the reference: the database is the only source of AI
provider configuration. An unreadable table is an error, and a key that will not decrypt
marks the registry `degraded`. Neither falls back to environment variables, and neither
reads as "nothing configured". A fallback to a second source is exactly the second source of
truth this pattern exists to remove.

**Invariants.**

- One fact, one owner. A second writable copy is a defect, not a configuration choice.
- Every non-owner copy is typed, imported, generated or drift-tested, and no other kind exists.
- A drift test proves its own scan was non-empty.
- Exemption lists fail when an entry no longer applies.
- Reading the owner either succeeds or fails loudly; it never silently substitutes another
  source.

**Do not use** for a value read in one place only: the owner and the reader are the same
line, and a gate around it is ceremony. And do not build a runtime "authority service" to
arbitrate between sources. If two candidates need arbitrating, there is one owner too many.

## Evidence status dimensions

**Problem.** "How sure are we?" is several questions, and collapsing them into one score
makes every one of them unanswerable. A 0.8 does not say whether the model was confident,
whether a human checked, whether all sources responded, or whether the answer is a year old.

**Method.** Keep each dimension in its own field, named for what it measures:

| Dimension | Question | v10r instance |
|---|---|---|
| **Verdict / signal** | What does the evidence suggest? Named so it never claims more than that | `NameConflictSignal` (`level` + `reasons`), deliberately not `risk score`, `verdict` or `safe` (`src/lib/name-check/report.ts`) |
| **Coverage** | How far did we look, and what could not be checked? | `NameCoverageStatus` per source: `complete`, `unavailable`, `quota_exhausted`, `credentials_missing`, `timed_out`, `manual_only` |
| **Method and confidence** | Who or what produced it, and how confident was the producer? | `ai_proposal.confidence` (the model's own tier per field), kept apart from `fieldProvenance` (`empty` / `ai-draft` / `human`), the record of who wrote the value (`src/lib/schemas/image-metadata.ts`) |
| **Use** | How far did a source get into an output? | `TurnItemState`: `available` → `considered` → `included` → `executed` → `cited`. Inclusion never claims influence (`src/lib/types/turn-trace.ts`) |
| **Grounding** | Does the claimed reference still resolve? | `CatalogCitationStatus`: `exists` / `drifted` / `none` (`src/lib/server/ai/catalog-citations.ts`) |
| **Proof grade** | What machine-checkable evidence backs it? | `PatternMaturity`: `proven` holds only with a linked test or showcase plus `verifiedAt` (`pattern-library/schema.ts`) |
| **Freshness** | When was it checked, and when does it go stale? | `retrievedAt` on name-check matches, `verifiedAt` plus the 180-day staleness warning in `patterns:validate` |
| **Aspiration vs floor** | Is this where we want to be, or a line we must not cross? | Perf targets (reported, never fail a build) vs ratchets (fail the gate) in `src/lib/server/perf/budgets.ts` |

**Invariants.**

- Distinct dimensions get distinct fields. A single score that merges confidence, coverage,
  provenance and freshness is never stored.
- A grade is only as fine as a machine can verify. Rungs that rest on self-declaration rot,
  which is why `PatternMaturity` has three values and not six.
- Field and type names describe the evidence, not a conclusion (`signal`, `coverage`,
  `drifted`, not `safe`, `verified`, `valid`).
- Self-reported confidence never stands in for acceptance. A model's `high` and a human's
  approval are separate facts.
- Missing coverage is a value, not an absence. An unanswered source is recorded as such,
  never left out of the count.

**Do not use** for internal values nobody reads as evidence (a cache hit flag needs no
confidence model), or where one boolean is honestly the whole story.

## Asset rights manifest

**Problem.** An app that ships third-party models, photos or fonts owes their authors the
attribution their licenses require. In v10r that obligation lived in two hand-kept
`ATTRIBUTION.md` files beside the assets, while the code that displays the assets carried a
second, partly different credit string. No gate tied the two together, and two CC BY 4.0 models
were shown in the app with no attribution at all.

**Method.** The module that owns an asset owns its rights record, beside the data that uses it:

```ts
interface AssetRights { author: string; license: string /* SPDX id */; source: string /* https */ }
```

- `$lib/3d/models.ts` (`Model3D.rights`) and `$lib/3d/parts.ts` (`PartPhoto.rights`) are the
  owners. `$lib/credits/asset-rights.ts` holds the type and the reading helpers
  (`requiresAttribution`, `licenseLabel`, `creditLine`).
- `$lib/credits/registry.ts` *derives* `assetCredits` from the owners. Nothing is re-typed.
- Every surface that shows an asset renders `creditLine(rights)`: the part-photo lightbox, and
  `/credits` for everything.
- `credits/registry.gate.test.ts` lists every file under `static/models/` and
  `static/images/parts/` and fails unless each is credited exactly once. It also checks every
  license is a well-formed SPDX id (`LicenseRef-PublicDomain` where a source dedicates no
  license) and every attribution-requiring license carries an author and an https source.
- The license identifiers come from the [SPDX License List](https://spdx.org/licenses/). For
  repository files outside the app, [REUSE](https://reuse.software/spec-3.3/) sidecars are the
  equivalent convention.

**What the gate does not prove.** That a license *permits* the use. Compatibility depends on how
an asset is used (modified, redistributed, commercial), which an identifier does not encode, and
automated compatibility checkers answer "uncertain" for exactly the interesting cases. The gate
checks that the metadata is present, well-formed and rendered. Whether the use is allowed stays
a human, and sometimes legal, judgement.

**Invariants.**

- Every shipped third-party file has exactly one rights record, owned by the module that uses it.
- No second attribution copy exists beside the files. The record is derived into every surface.
- A license that requires attribution is rendered wherever the asset is credited.
- Rights metadata is never presented as a legal conclusion.

**Do not use** for first-party assets the project made itself, or for npm dependencies, whose
license metadata the package already carries (the credits registry checks those against
`node_modules` instead).
