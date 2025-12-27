# Biome

Linter and formatter. Fast, single binary, replaces ESLint + Prettier.

## Why Biome

| Aspect | Biome | ESLint + Prettier |
|--------|-------|-------------------|
| Speed | ~200ms (10k lines) | 3-5 seconds |
| Config files | 1 | 3-4 |
| Dependencies | 1 binary | 127+ packages |
| Svelte support | Experimental (v2.3+) | Full |

Biome wins: 10-25x faster, single config, minimal dependencies.

## Svelte Status (v2.3.0)

| Feature | Status |
|---------|--------|
| JS/TS in `<script>` | Supported |
| CSS in `<style>` | Supported |
| Svelte control flow | Partial (not fully parsed) |

Requires opt-in: `html.experimentalFullSupportEnabled: true`

## Our Choice

We use Biome despite experimental Svelte support:

- Speed and DX benefits outweigh limitations
- Svelte control flow issues are minor in practice
- Biome's Svelte support is actively improving
- Aligns with "fast and modern" stack philosophy

**Fallback:** ESLint + Prettier if Biome causes issues with complex Svelte templates.

## Stack Integration

| Layer | Choice | Why |
|-------|--------|-----|
| Linting | **Biome** | Fast, comprehensive rules |
| Formatting | **Biome** | Consistent, fast |
| Alternative | ESLint + Prettier | Full Svelte syntax support |

## Commands

```bash
bun run lint         # Check for issues
bun run lint:fix     # Auto-fix issues
bun run format       # Format code
bun run check        # Lint + format check
```

## Configuration

Single `biome.json` at project root. See [../../blueprint/quality/](../../blueprint/quality/) for configuration details.

## Related

- [../core/sveltekit.md](../core/sveltekit.md) - Framework
- [../../blueprint/quality/](../../blueprint/quality/) - Configuration examples
