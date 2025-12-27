# Biome

## What is it?

Unified toolchain for web projects combining code formatting and linting. Written in Rust, single binary. 97% Prettier-compatible formatter with 340+ lint rules from ESLint, TypeScript ESLint, and other sources.

## What is it for?

- Code formatting (Prettier replacement)
- Static code analysis and linting (ESLint replacement)
- Import organization and sorting
- Integrated format + lint + organize in one command

## Why was it chosen?

| Aspect | Biome | ESLint + Prettier |
|--------|-------|-------------------|
| Speed | **~35x faster** (formatting) | Baseline |
| Lint speed | **~15x faster** | 3-5 seconds |
| Config files | 1 (`biome.json`) | 3-4 |
| Dependencies | 1 binary | 127+ packages |
| Multi-threading | Yes | Single-threaded |

**Key advantages:**
- 10k lines formatted in ~50ms (vs 1-2s for Prettier)
- Single configuration file
- Multi-core utilization
- Zero configuration required (sensible defaults)
- Used by AWS, Google, Microsoft, Discord, Vercel

## Known limitations

**Plugin ecosystem:**
- Younger ecosystem than ESLint
- ~80% ESLint compatibility in 2025
- ESLint retains advantage for niche customizations
- Not all ESLint plugins have Biome equivalents

**Svelte support (v2.3+):**
| Feature | Status |
|---------|--------|
| JS/TS in `<script>` | Supported |
| CSS in `<style>` | Supported |
| Svelte control flow (`{#if}`, `{#each}`) | **Not fully parsed** |
| Cross-language lint rules | Not supported |

- Requires opt-in: `html.experimentalFullSupportEnabled: true`
- May need to disable rules: `useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports`
- Formatting "might not match desired expectations" for Svelte templates
- Marked as experimental—subject to changes

**Fallback:** ESLint + Prettier if Biome causes issues with complex Svelte templates.

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - Framework
