---
name: project_quick_search_refactor
description: quick-search blueprint promotion — new dir created, stale refs catalogued, old file left for git rm
metadata:
  type: project
---

`docs/blueprint/quick-search/` created (README, architecture, indexing, blog-fts, ui). Old `docs/blueprint/app-shell/quick-search.md` left in place — awaiting `git rm` by orchestrator.

**Why:** Feature outgrew app-shell scope; old doc described never-built design with wrong component names and missing architecture.

**How to apply:** If asked to update quick-search docs, the canonical location is now `docs/blueprint/quick-search/`. The stale file at `docs/blueprint/app-shell/quick-search.md` should be removed if still present.

Out-of-scope stale refs (QuickSearch naming, wrong paths) remain in: `docs/blueprint/design/components.md`, `docs/blueprint/app-shell/component-organization.md`, `docs/blueprint/app-shell/sidebar.md`, `docs/blueprint/app-shell/empty-states.md`, `docs/blueprint/app-shell/keyboard-shortcuts.md` (table row entry), `docs/blueprint/app-shell/ai-assistant.md` (comparison table), `docs/blueprint/app-shell/shell-state.md`. These require a separate naming-cleanup pass.
