---
name: Content layout (cross-agent Round 2)
description: Final file/folder layout for the content/translation system after cross-pollination with scout (UUID id), daty (post_translations side table), apy (policy + placeholder primitive)
type: project
---

Final layout for the file-backed content + translation pipeline.

**Why:** Multi-agent Round 2 surfaced four shape changes: stable UUID `id` in frontmatter (scout), body in `post_translations` side table with new `tcBody()` resolver (daty), frontmatter policy as a constant with per-domain override (apy), placeholder masking as a composable primitive (apy).

**How to apply:** When asked "where does X go?" for content/translation work, use these canonical homes.

```
content/blog/<slug>/
  meta.json               // id (UUIDv4), slug, dates, non-translatable
  en.md                   // frontmatter (translatable keys) + body
  de.md
  ru.md

src/lib/server/content/   // domain-agnostic core
  frontmatter.ts          // parse/serialize meta.json + per-locale .md
  hash.ts                 // moved from blog/content-hash.ts
  upsert.ts               // generic file->DB diff, keyed on UUID id
  policy.ts               // translatable-key policy + per-domain override
  placeholders.ts         // mask/restore code fences (composable)
  translate.ts            // translateContent core
  push.ts                 // pushContent core
  tc-body.ts              // async body resolver against *_translations
  types.ts                // PushReport, TranslationProvenance, FrontmatterPolicy
  index.ts

src/lib/server/blog/      // blog-specific (stays)
  pipeline.ts
  rehype-rewrite-r2.ts    // R2 asset pipeline is blog-owned
  sanitize-schema.ts
  asset-folders.ts
  post-folders.ts
  mutations.ts
  queries.ts
  schemas.ts
  types.ts

src/lib/i18n/content.ts   // tc() sync frontmatter resolver (unchanged)

scripts/content/
  new.ts                  // bun run content:new <slug> — scaffolds folder + UUID
  translate/
  push/
  lib/

src/routes/admin/content/posts/preview/[slug]/[locale]/+page.server.ts
```

**Import direction (one-way):**
- `scripts/content/*` -> `src/lib/server/content/` -> `src/lib/server/db/`
- `src/lib/server/blog/` -> `src/lib/server/content/` (never reverse)
- `src/lib/i18n/content.ts` stays type-only against schema

**Canonical-home rules:**
- File-on-disk shape, hash, diff, translate orchestration -> `src/lib/server/content/`
- Domain table shape, queries, asset pipeline, render sanitization -> `src/lib/server/<domain>/`
- Sync frontmatter resolver -> `src/lib/i18n/content.ts`
- Async body resolver -> `src/lib/server/content/tc-body.ts`
- One-shot scaffolds -> `scripts/content/`
