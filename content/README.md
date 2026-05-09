# Content (file-as-source)

Long-form, multilingual content lives here as markdown files. Files are the source of truth pre-push; the database is the source of truth at runtime. Pushes are one-way (`bun run content:push`); the admin UI is read-only for any post whose row has `source_path IS NOT NULL`.

## Layout

```
content/
├── glossary.md             # do-not-translate terms + per-locale register
└── blog/
    └── <slug>/
        ├── en.md           # source of record (frontmatter + body)
        ├── de.md           # translation; frontmatter adds sourceContentHash
        ├── ru.md           # translation; frontmatter adds sourceContentHash
        └── assets/         # local images, uploaded to R2 on push (optional)
```

## Daily flow

```
bun run content:new <slug>          # scaffolds en.md with a fresh UUID
# author en.md in the IDE
# ask Claude Code: "translate content/blog/<slug>/en.md to de and ru"
# → de.md and ru.md are written next to it; their frontmatter sourceContentHash
#    matches en.md's current contentHash
bun run content:check                # parity + staleness audit
bun run dev                          # preview at /admin/content/posts/preview/<slug>/<locale>
bun run content:push <slug>          # idempotent upsert into DB
```

## Frontmatter contract

```yaml
---
id: 0190f6c2-7b8a-7c3d-9e1f-2a3b4c5d6e7f   # UUID v7 from content:new — never edit
slug: introducing-v10r                       # mutable; the runtime URL key
title: Introducing Velociraptor              # translatable
summary: A multilingual SvelteKit template.  # translatable, optional
tags: [meta, intro]                          # raw tag slugs
status: draft                                # draft | published | archived
date: 2026-05-09                             # raw ISO date
domain: announcements                        # optional blog domain slug
sourceContentHash:                           # de.md/ru.md only; matches en.md hash at translation time
---
```

`id` is the post identity. It survives slug renames. **Don't edit it.**

`slug` is mutable — change it freely; `content:push` updates the row.

`title` and `summary` are the **only** translatable frontmatter fields. Tag slugs, status, date, and domain pass through unchanged in every locale.

## Translation discipline

1. Read [`glossary.md`](./glossary.md) before authoring a translation pass — it locks product names, agent names, and per-locale register (German Sie/du, Russian вы/ты).
2. Re-author each locale; never word-map. Voice should sound native, not translated.
3. Set `sourceContentHash` in the non-EN frontmatter to the EN file's current `contentHash` (computed by `bun run content:check` if you forget).
4. Three locales is a three-locale change. `content:check` exits non-zero if a locale is missing or stale.

## Asset handling

Two modes, both supported:

- **Absolute R2 URL** in markdown — push leaves it untouched. Best for assets already uploaded.
- **Relative path** (`./assets/hero.png`) — push uploads the file to R2 via `createAsset`, links it to the post, and rewrites the markdown to the absolute URL before storing.

Place local assets under `content/blog/<slug>/assets/`.

## Where things go

| Concern | Lives in |
|---|---|
| Source of record | `content/blog/<slug>/<locale>.md` |
| Push script | `scripts/content/push.ts` |
| Parity audit | `scripts/content/check.ts` |
| Scaffold script | `scripts/content/new.ts` |
| File→DB primitives | `src/lib/server/content/` |
| Runtime read | `src/routes/(public)/blog/[slug]/+page.server.ts` (DB-backed) |
| Preview (file-backed) | `src/routes/admin/content/posts/preview/[slug]/[locale]/` |
