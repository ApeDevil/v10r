# Biome

Lint + format toolchain (Rust, single binary, one `biome.json`). Runs as part of `bun run validate`. See the `biome` skill for config and rule details.

## Why was it chosen?

- One binary, one config file — replaces the ESLint + Prettier multi-package setup.

## Known limitations

**Svelte support is experimental (v2.3+):**
- JS/TS in `<script>` and CSS in `<style>` are supported; Svelte control flow (`{#if}`, `{#each}`) is **not fully parsed**, and cross-language lint rules don't work.
- Requires opt-in `html.experimentalFullSupportEnabled: true`; may need `useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports` disabled.

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - Framework
