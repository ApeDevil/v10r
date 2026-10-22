# Repository Guidelines

Velociraptor (v10r) is a SvelteKit pattern library for adaptation. Claude Code follows
[CLAUDE.md](CLAUDE.md).

## Project Structure

- `src/routes/`: localized pages under `[[locale=locale]]/`; REST/SSE under `api/`.
- `src/lib/components/`: reusable UI; `src/lib/state/`: shared rune state.
- `src/lib/server/`: domains, database schemas/access, and integrations.
- `static/`: assets; `content/`: authored content; `messages/`: translations.
- `pattern-library/`: canonical registry; `mcp/`: stdio transport; `scripts/`: tooling.

## Development and Validation

Claude Code cloud sessions are the default place to develop: no container, no secrets,
commands run directly (`bun run validate`). Local sessions run tooling inside the `v10r`
Podman container. What runs where, and what to report as not run:
[development-environment.md](docs/foundation/development-environment.md).
Never run package managers on the host; keep `package.json` and `bun.lock` synchronized.

```bash
bun run validate                     # authoritative gate (cloud)
bun run validate:build               # + production build and perf ratchet
podman compose up -d                 # local: start development on :5173
podman exec v10r bun run validate    # local: the same gate in the container
```

The gate includes typechecking, Biome, tests, registry/excerpts, i18n/content, and quality
checks. No CI pipeline exists. Report failures accurately.

## Architecture and Coding Style

Keep domains framework-free; adapters own HTTP responses, redirects, and date
serialization. Never import `$lib/server/` into `.svelte` or universal `+page.ts`.
Change code directly: no compatibility layers, migration shims, or deprecation paths.

Follow `biome.json`: tabs, LF, 120-column width, single JS quotes, semicolons, trailing
commas. Use PascalCase components, kebab-case modules, and `.svelte.ts` for runes.
Consult [docs/naming.md](docs/naming.md) before introducing names; comments explain why —
the principle behind both is [docs/foundation/self-expressive-project.md](docs/foundation/self-expressive-project.md).
Never name a prop `state`.

Use existing components instead of raw buttons, inputs, selects, or textareas.
Exceptions: hidden inputs, table-row checkboxes, numeric selects, and specially styled
interactive regions. Colors use `src/app.css` tokens.

## Testing

Co-locate Vitest `*.test.ts`; database tests use `*.pglite.test.ts` and PGlite.
Run one file with `bunx vitest run <path>` (locally: `podman exec v10r bunx vitest run <path>`).
MCP uses `bun:test` (`test:mcp`). Test invariants, security, and regressions; verify UI
through browser showcases. No coverage threshold is configured.

## Documentation and Generated Files

Start at [docs/README.md](docs/README.md); navigate directory READMEs before topics.
Never grep blindly through `docs/`. Read `docs/codebase-organization.md` and
`docs/system-abstraction.md` for architecture. Reference canonical sources; avoid duplicate
stack documentation.

Never hand-edit generated pattern pages, Paraglide output, MCP excerpts, or retrieval
indexes. Use `package.json` generators; `refresh` also ingests docs into
the database. See [mcp/README.md](mcp/README.md) for machine-readable access.

## Commits and Branches

History mixes informal subjects with `feat(scope):` and `refactor(scope):`; prefer
descriptive subjects that explain behavior.

Work on a feature branch: commit and push it, hand off the branch and its HEAD SHA, and stop.
No PR is needed; a PR is only the fallback vehicle of a ship. GitHub `main` moves only when
Stas explicitly says to ship in the conversation — then follow
[shipping.md](docs/stack/ops/shipping.md) (squash into `main` → GitLab sync → Vercel). Never push
`main` or GitLab, never force-push, stash, or reset. Run a `vr` command only when
specifically requested.
