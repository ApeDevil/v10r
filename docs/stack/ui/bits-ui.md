# Bits UI

Headless, unstyled, accessible Svelte primitives. The project wraps these into the layered component system in `$lib/components/` (primitives, composites, etc.) — see CLAUDE.md "Component-First Rule".

## Why was it chosen?

- Zero styling opinions — primitives carry the WAI-ARIA behavior; the project owns all visual styling via UnoCSS + scoped CSS.

## Known limitations

- Missing primitives vs Melt UI: Table of Contents, Tags Input, Toast.

## Related

- [unocss.md](./unocss.md) - Styling
- [../forms/superforms.md](../forms/superforms.md) - Form handling
