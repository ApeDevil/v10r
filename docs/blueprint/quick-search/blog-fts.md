# Blog Full-Text Search

## Overview

Blog search (Lane B) runs a live Postgres FTS query against `blog.revision`. Results are genuinely per-locale — blog posts are authored per locale, so there is no EN-fallback badge for blog hits.

## Schema: `search_vector`

`blog.revision` carries a `tsvector` column (`search_vector`) defined in `src/lib/server/db/schema/blog/revision.ts`:

```ts
searchVector: tsvector('search_vector'),
// GIN index:
index('blog_revision_search_vector_idx').using('gin', table.searchVector)
```

The column is **NOT a generated column**. It is app-populated on insert.

## Why Not a Generated Column (42P17)

Neon/Postgres rejects a multi-field, per-locale `to_tsvector(...)` expression inside a `GENERATED ALWAYS AS` column because the expression is not immutable — `to_tsvector(regconfig, text)` varies by the `regconfig` argument, which is a runtime value, not a constant. The error is `SQLSTATE 42P17` (feature not supported).

Additionally, `drizzle-kit push` silently ignores expression changes to generated columns, so even if you work around the Neon rejection, schema drift goes undetected.

The solution mirrors `rag.llmwiki_page`: populate `search_vector` in application code on every insert.

## App-Populated on Insert

`createRevision()` in `src/lib/server/blog/mutations.ts` builds the vector at write time:

```ts
const cfg = localeRegconfig(locale);  // 'english' | 'german' | 'russian' | 'simple'
const searchVector = sql`
  setweight(to_tsvector(${cfg}::regconfig, ${data.title}), 'A')
  || setweight(to_tsvector(${cfg}::regconfig, ${data.summary ?? ''}), 'B')
  || setweight(to_tsvector(${cfg}::regconfig, ${data.markdown}), 'C')
`;
```

Weights: title=A (highest), summary=B, markdown body=C (lowest). The `cfg` value is a server-side picklist from `localeRegconfig()`, never user input — safe to cast as `regconfig`.

## `localeRegconfig`

`$lib/server/search/regconfig.ts` maps app locales to Postgres FTS configurations:

| Locale | Regconfig |
|--------|-----------|
| `en` | `english` |
| `de` | `german` |
| `ru` | `russian` |
| unknown | `simple` (no stemming — safe exact-token fallback) |

The same `regconfig` MUST be used at write time (`to_tsvector`) and query time (`websearch_to_tsquery`). Mismatching them silently drops hits due to stemming differences.

## Query: `searchPublishedRevisions`

`src/lib/server/blog/queries.ts`, called by `$lib/server/search/adapters/blog.ts`.

```ts
export async function searchPublishedRevisions(
  query: string,
  locale: string,
  limit = 20,
): Promise<RevisionSearchHit[]>
```

**Joins:** `published_revision` → `revision` → `post`.

**Filters:**
- `published_revision.locale = locale` (locale-scoped)
- `post.status = 'published'`
- `post.deleted_at IS NULL`
- `revision.search_vector @@ tsquery`

**Ranking:** `ts_rank_cd(search_vector, tsquery) DESC`.

Only currently-published, non-soft-deleted content matches. Drafts never surface in search.

## `ts_headline` and XSS-Safe Highlighting

`ts_headline` returns a snippet with match positions marked. Because `ts_headline` output is not XSS-safe, it is **never rendered via `{@html}`**.

Instead, non-printing sentinel characters are used as delimiters:

- `HL_START` = STX (`\x02`) — marks the start of a highlighted word
- `HL_STOP` = ETX (`\x03`) — marks the end

These are passed as `StartSel`/`StopSel` options to `ts_headline`. They cannot appear in real content, so splitting on them is unambiguous.

The blog adapter (`$lib/server/search/adapters/blog.ts`) strips the sentinels into a plain `snippet` string + `highlight: [number, number][]` character ranges. The palette and `/search` page iterate these ranges to wrap matched text in `<mark>` elements — no raw HTML injection.

Headline options: `MaxFragments=1, MinWords=6, MaxWords=26, ShortWord=2`.

## Not Yet Implemented

- Doc heading-level deep anchors (would need rehype-slug id matching in the markdown pipeline)
- Recent-searches history (localStorage)
- `/docs/programming` agents indexing
