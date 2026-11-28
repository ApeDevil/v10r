---
title: "Markdown editor"
description: "A CodeMirror-based source markdown editor with a slash-command palette that auto-inserts custom syntax."
category: "Content & Blog"
---

# Markdown editor

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Content & Blog · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

A CodeMirror-based source markdown editor with a slash-command palette that auto-inserts custom syntax.

**When to use:** Use when authoring or editing markdown content that relies on the project's custom directive syntax.

## Docs

- `docs/blueprint/blog.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/blog.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/blog.md))

## Code

- `src/lib/components/desk/panels/editor/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/desk/panels/editor) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/desk/panels/editor))

## Proof

- [`/showcases/desk`](/showcases/desk) — EditorPanel in the desk workspace

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Markdown pipeline and custom syntax](/docs/pattern-library/markdown-pipeline) — The slash commands insert the custom syntax the pipeline renders.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `markdown-editor` in `pattern-library/registry.json`._
