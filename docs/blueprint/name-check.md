# Name check — search aggregation over unreliable registries

A public, no-login pre-screen for a proposed brand, product or project name: what already
exists that could conflict with it. One report from several upstreams of uneven
reliability — trade mark registries, company registers, RDAP, web search — with per-source
coverage, dependency-free name similarity, and a descriptive conflict signal that never
claims legal availability.

**Page:** `/showcases/name-check` · **API:** `POST /api/name-check` · **Domain:**
`src/lib/server/name-check/` · **Contract:** `src/lib/name-check/report.ts` ·
**Schema:** `src/lib/schemas/name-check.ts`

## The problem it solves

Clearing a name means searching six databases by hand and reconciling what they say. Each
one has a different API story: EUIPO has an official one behind a registered app, GLEIF is
keyless, DPMA sells a contract, WIPO and USPTO publish none, domain registries speak RDAP
(some of them), and "is anyone already trading under this name" is a web search. The
feature treats that as a **search aggregation problem**: one query, every source at once,
partial results as a first-class outcome.

What it deliberately is not: a trademark clearance. The report says what was found and
where the search could not look. It never says "available", "safe", or a risk percentage —
`report.ts` has no field that could render as one.

## Vocabulary

| Term | Meaning |
|---|---|
| **name check** | The feature. Domain `name-check/`, route `/showcases/name-check`, API `/api/name-check`, keys `showcase_name_check_*`. |
| `NameSource` | One upstream: `id`, `kind`, `territories`, `manualUrl()`, optional `configured()` and `search()`. No `search` ⇒ manual-only. Not "adapter" (`*.adapter.ts` is the transport seam) and not bare "source" (turn provenance). |
| `NameMatch` | One finding, discriminated on `kind`: `trademark` · `company` · `domain` · `web`. Each kind has its own facts; every one carries `similarity`, `jurisdiction`, `territoryRelevance`, `url`, `retrievedAt`. |
| `NameSimilarity` | `{ score 0–100, basis }`. Shown as "name similarity", never as a probability of anything. |
| `NameCheckCoverage` | Per source: `complete` · `unavailable` · `quota_exhausted` · `credentials_missing` · `timed_out` · `manual_only`, plus the manual URL, `retrievedAt`, `cached`. |
| `NameConflictSignal` | `level` (`none` · `similar` · `potential` · `strong`) + `reasons` (codes with params, localised on the page) + `manualReviewRecommended`. |
| `territory` vs `jurisdiction` | The query's scope (`de` · `eu` · `worldwide`) vs a record's origin (`DE`, `EM` for an EU mark, `WO` for an international registration). |

## Pipeline

```
+page.server.ts actions.check ─┐
                               ├─► checkName(query, deps)
POST /api/name-check ──────────┘        │  per source: territory filter → configured? →
                                        │  readThrough(cache) → breaker → daily quota →
                                        │  bulkhead → deadline.child(6 s) → source.search()
                                        ▼
        normalize → sources (concurrent) → dedupe → similarity → relevance → signal → report
```

- **Normalisation** (`normalize.ts`): NFKD, accents and `ß` folded, lowercase, punctuation
  and hyphens dropped, a leading article and trailing legal forms stripped.
  "The Velo-Raptor!" and "veloraptor" are the same key. One normaliser for every name the
  check touches — the query and every candidate.
- **Similarity** (`similarity.ts`): exact → normalised → edit distance (≤ 2) → Kölner
  Phonetik → shared dominant token → affix containment → bigram floor. The best rung wins
  and names itself as `basis`, which is what the page shows beside the score. Bands mirror
  the spec: 100 / 100 / 94 / 88 / 81 / ~62. Nothing below `SIMILARITY_FLOOR` (60) is shown.
- **Relevance**: `nice-classes.ts` maps a category to Nice classes and grades a mark
  `same` · `possibly` · `unrelated` · `unknown` — unrelated is still shown, never dismissed.
  `relevance.ts` grades a jurisdiction against the territory; an EU mark is `same` for
  Germany, an international registration `overlapping`.
- **Signal** (`signal.ts`): explicit predicates. *Strong* = near-exact, live, same
  territory, same category. *Potential* = close mark in a related category, or near-exact
  with the category unknown, or an active exact company in the territory, or a registered
  exact domain plus web usage. *Similar* = anything above the floor. `manualReviewRecommended`
  is set at `potential` and above, and whenever a trade mark source in scope was not
  searched — for a German territory that is always, because DPMA cannot be.

## Sources

| Source | Kind | Access | What a miss means |
|---|---|---|---|
| EUIPO (`sources/euipo.ts`) | trademark | Official API; OAuth2 client credentials + `X-IBM-Client-Id`, saved as a source connection. Hosts are part of the connection because the Sandbox portal runs on its own `api-sandbox` / `auth-sandbox` hosts; the production hosts are the defaults. Two RSQL queries: contained term and prefix. | No EU trade mark or EU-designating international mark matched. |
| GLEIF (`sources/gleif.ts`) | company | Keyless JSON:API; full-text + fuzzy completions; 60 req/min. | No **LEI holder** by that name. Most companies have no LEI — this is a signal, not a register. |
| RDAP (`sources/rdap.ts`) | domain | IANA bootstrap (cached 24 h, static fallback), DENIC's pilot server for `.de` by override, DNS delegation as evidence for `.eu` (no RDAP), `lookup_unavailable` for the rest. 200 → registered, 404 → not registered, else unknown. | The domain is not registered at that registry. Says nothing about a mark. |
| Web (`sources/web.ts`) | web | Vendor seam: the first connected of Tavily then Brave, else `credentials_missing`. Exact-phrase query, ten hits, graded on host label and title. | Nothing on the web's first page used the name. |
| DPMA, TMview, WIPO, USPTO, Handelsregister, OpenCorporates (`sources/manual.ts`) | trademark / company | Manual links only: no API, a paid contract, or terms that forbid scripted access. | Not searched. The coverage row says so. |

Every source declares `manualUrl()` and the coverage table shows it on every row — the
authoritative search is one click away whether the automated one ran or not.

## Resilience and spend

A source that cannot answer becomes a coverage row, never an error response
(`check.ts`, `coverageStatusFor`). Around each live source, in this order:

- `readThrough` on a shared cache policy — 24 h for registries, 1 h for domains — keyed by
  `<source>:<territory>:<sha256(normalised name)>`. Only successes are cached; a cached
  failure would replay an outage for a day. The envelope keeps the upstream `retrievedAt`.
- One `defineBreaker` for the domain, subject = source id: three failures in two minutes
  opens it for five; a 429 trips it for `Retry-After`.
- `takeDailyQuota` (`quota.ts`): per-source counters in Redis, sized to the free tiers in
  `config.ts` (`DAILY_QUOTA`). Fails open — the counter protects a bill, not a boundary.
- `defineBulkhead` per source (8 slots for RDAP's nine lookups, 4 elsewhere).
- `deadline.child(SOURCE_CEILING_MS)` inside the request's own budget: the fan-out takes
  8 s of the 10 s hook budget and holds 700 ms back for the response.

The per-IP limiter (`RATE_LIMIT_*`, 10 per minute) runs **before** any of this, on both the
form action and the JSON route, with the honeypot in front of it on the form.

## Privacy

The name a visitor types may be an unreleased brand. Therefore: POST bodies, never `?q=`;
no log line carries the name (errors are logged by class and status, `fetch-json.ts` never
logs a URL or body); the cache key is a hash; no table stores a query; the report is
returned and forgotten. The privacy showcase and `docs/stack/vendors.md` list the upstreams
the name is sent to.

## What the UI never says

- "Legally available", "safe to use", or any percentage that could read as legal risk.
- A similarity score without its basis.
- "No matches" without the coverage table beside it saying *where* — the closing note on
  the page spells out that it means "in the sources marked complete".
- A colour without a word: every level and status pairs its Badge or Alert with text.

## Source connections

Vendor credentials are **administrator-managed and persisted**, never environment-based —
the same shape as the AI providers' `ai.provider_connection`
(`docs/blueprint/ai/provider-routing.md`). The admin connects each vendor under
**Admin → Name check** (`/admin/name-check`): enable it, enter EUIPO's client id and secret
or a search API key, test, save. `.env` carries nothing for this feature; `ENCRYPTION_KEY`
stays a deployment secret because the database cannot protect its own key.

| Piece | Where | What it owns |
|---|---|---|
| Table `name_check.source_connection` | `db/schema/name-check/source-connection.ts` | One row per vendor (`euipo`, `tavily`, `brave`): `enabled`, `client_id`, `secret_ciphertext`, `api_base`, `token_url`, `version`, `updated_at/by`. Absent row = never configured. CHECKs: only EUIPO carries a client id or hosts; hosts are `https://`. |
| Reads/writes | `db/name-check/source-connections.ts` | Ciphertext in, ciphertext out. Every write is a compare-and-swap on `version`. |
| Encryption | `security/aes-gcm.ts` (`openSecret`, `KeyStatus`) + `security/encryption-key.ts` | The envelope the AI keys and Discord tokens use; `openSecret` answers none / ready / undecryptable instead of throwing. |
| Connections | `name-check/connections.ts` → `resolveNameSourceConnections(rows, key)` | Opens each secret, decides `configured` once (enabled ∧ opened ∧ for EUIPO a client id), builds the `NameSourceCredentials` the sources receive as a **closure** — the plaintext is never a field. `publicNameSourceConnection` is the only shape that crosses to a client; `security/load-leak-gate.test.ts` refuses `secretCiphertext` in any client-facing file. |
| Composition | `name-check/index.ts` → `loadNameSourceConnections()` / `loadNameSourceCredentials()` | The app-side doors: `db` + `getEncryptionKey()`, read at the start of every operation, so a save is live on the next check on every instance. The admin page uses the strict one (an unreadable table is an error it renders). The public check uses the forgiving one: an unreadable table or a rotated key becomes `credentials_missing` rows — the check never fails on its settings, and the log line names the error class, not a query. |
| Admin operations | `name-check/connection-settings.ts` | Save / remove secret / test: seal → guarded write → best-effort audit (`name_check.source.*`, detail = version, changed fields, `keyChange`; never a secret). |
| Connection test | `name-check/connection-test.ts` | The vendor's own `search()` with a fixed probe name under `SOURCE_TEST_BUDGET_MS`, one attempt, outside cache, quota and breaker, rate-limited per admin. Classified `ok / invalid_credentials / rate_limited / timeout / unavailable / unknown`; a wrong host is `unavailable`, not a wrong password, and a failure carries a secret-free `detail` naming the step and status (`token endpoint: HTTP 401` = wrong secret, `trademark search: HTTP 403` = no approved subscription yet). The EUIPO token cache is cleared first so a draft secret cannot ride the saved one's token. |

## Testing

`normalize`, `similarity`, `signal`, `relevance`, `quota` and the source **mappers** are
unit-tested with fixtures; `check.test.ts` drives the orchestrator with fake sources —
partial failure, timeout, quota, credentials, cache hit, floor, territory scoping, the
`onSourceSettled` seam, and a spy proving the name never reaches `console.error`. The HTTP
clients themselves are not mocked-and-tested: the only realistic risk there is the remote
contract, which a mock cannot witness (see `testing/strategy.md`).

## Emulating it

1. Declare each upstream as a `NameSource` — territories and `manualUrl` first, `search`
   second. A registry you cannot query still earns a row.
2. Map every thrown error class to exactly one coverage status in one place.
3. Cache successes only; put the hash of the query in the key, never the query.
4. Keep the similarity engine pure and fixture-tested; put the thresholds in `config.ts`.
5. Derive the signal from predicates over evidence, and return reasons as codes so the
   page can explain in the reader's language.
6. Rate-limit before the fan-out; quota per source; deadline per source; breaker per source.
7. Keep vendor credentials in an administrator-managed table sealed under the deployment
   key, opened once per operation into a closure — never in `.env`, never on a field.

## Later

- Progressive delivery: `checkName()` already fires `onSourceSettled` per source; an NDJSON
  route (`retrieval/ingest/stream` is the precedent) can forward rows as they land.
- Altcha escalation after repeated checks from one bucket (`verifyAltcha` exists; adaptive
  gating does not yet).
- Companies House and OpenCorporates as live sources once a key is worth its terms;
  DPMAconnectPlus if the contract is.
- A Vely tool over the same `checkName()`, saved searches, monitoring for new filings.
