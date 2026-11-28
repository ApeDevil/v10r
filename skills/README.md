# v10r Agent Skills

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

The v10r pattern library packaged as [Agent Skills](https://agentskills.io/specification): one agent skill per registry group plus a selection entry point. Everything here is generated from the registry — the same source as the `docs/pattern-library/` pages and the Pattern MCP — so it cannot drift from them. Deep patterns ship as `references/<id>.md` inside their group; index rows link their docs page on GitHub.

Install into a coding agent (Claude Code, Codex, Cursor and other Agent Skills loaders):

```bash
npx skills add ApeDevil/v10r --skill v10r-architecture-selection   # the entry point
npx skills add ApeDevil/v10r --skill v10r-intelligence           # or any group
```

Pass `--skill` explicitly: the repo also holds its own development skills under `.claude/skills/`, which are not part of this package.

| Agent skill | Covers | Patterns (deep) |
|---|---|---|
| [`v10r-architecture-selection`](v10r-architecture-selection/SKILL.md) | how to choose and order patterns | 170 |
| [`v10r-foundations`](v10r-foundations/SKILL.md) | Architecture & Request Pipeline, App Shell & Navigation, UI Components & Design System, Forms & Validation, Internationalization (i18n), Docs & Agent Experience | 50 (16) |
| [`v10r-data`](v10r-data/SKILL.md) | Databases & Storage, Database Operations | 12 (0) |
| [`v10r-identity-safety`](v10r-identity-safety/SKILL.md) | Identity & Access, Anti-Abuse, Admin & Privacy | 17 (1) |
| [`v10r-intelligence`](v10r-intelligence/SKILL.md) | AI, Office Workflows | 26 (13) |
| [`v10r-features`](v10r-features/SKILL.md) | Analytics, Notifications, Jobs & Scheduling, PWA, Data Viz, 3D, Content & Blog, Desk Workspace, External Integrations | 34 (7) |
| [`v10r-velocity`](v10r-velocity/SKILL.md) | Interaction Velocity, Data Velocity, Runtime Velocity, Velocity Measurement | 22 (19) |
| [`v10r-integrity`](v10r-integrity/SKILL.md) | Truth & Evidence, Derivation & Provenance, Durable Execution | 9 (8) |
