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

Run tooling inside the `v10r` Podman container.
Never run package managers on the host; keep `package.json` and `bun.lock` synchronized.

```bash
podman compose up -d                 # start local development on :5173
podman exec v10r bun run build       # production build
podman exec v10r bun run test        # Vitest suites
podman exec v10r bun run lint        # Biome checks
podman exec v10r bun run validate    # authoritative gate
```

The gate includes typechecking, Biome, tests, registry/excerpts, i18n/content, and quality
checks. No CI pipeline exists. Report failures accurately.

## Architecture and Coding Style

Keep domains framework-free; adapters own HTTP responses, redirects, and date
serialization. Never import `$lib/server/` into `.svelte` or universal `+page.ts`.
Change code directly: no compatibility layers, migration shims, or deprecation paths.

Follow `biome.json`: tabs, LF, 120-column width, single JS quotes, semicolons, trailing
commas. Use PascalCase components, kebab-case modules, and `.svelte.ts` for runes.
Consult [docs/naming.md](docs/naming.md) before introducing names; comments explain why.
Never name a prop `state`.

Use existing components instead of raw buttons, inputs, selects, or textareas.
Exceptions: hidden inputs, table-row checkboxes, numeric selects, and specially styled
interactive regions. Colors use `src/app.css` tokens.

## Testing

Co-locate Vitest `*.test.ts`; database tests use `*.pglite.test.ts` and PGlite.
Run one file with `podman exec v10r bunx vitest run <path>`.
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

## Commits and Pull Requests

History mixes informal subjects with `feat(scope):` and `refactor(scope):`; prefer
descriptive subjects. PRs should explain behavior, link relevant issues,
report validation, and include screenshots for UI changes.

Preserve uncommitted work. Never stage, commit, push, stash, or reset without explicit
instruction. Run a `vr` command only when specifically requested; `vr ship` deploys.
