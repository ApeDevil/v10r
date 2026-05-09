---
id: 019e0bd2-9cf9-775b-8208-ab374dff5cb5
slug: hello-velociraptor
title: 'Hello, Velociraptor'
summary: A first multilingual post pushed via the file workflow.
tags: []
status: draft
date: '2026-05-09'
domain: announcements
---

This is the first post pushed through the file-as-source content workflow.

The post lives as three markdown files: `en.md`, `de.md`, `ru.md`. The English file is the source of record. The German and Russian files are translations authored in the dev loop. Every push computes a content hash; identical files are no-ops.

## What this verifies

- The scaffold script writes a frontmatter with a stable UUID.
- `bun run content:check` flags missing locales and stale translations.
- `bun run content:push` upserts the post and creates one revision per locale.
- Re-running push without edits is a no-op (skip-on-hash).
- The preview route at `/admin/content/posts/preview/<slug>/<locale>` renders from the file, with a banner showing whether the file matches the database.

## Why files first

Files are git-versioned. Translations get reviewed in pull requests instead of in a CMS. Cony writes the same file the engineer reads. The database is just a fast lookup index — nothing original lives there that didn't come through a file.
