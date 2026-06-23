# Svelte 5

The UI framework. Runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) are the reactivity model. See the `svelte5-runes` skill for runes syntax and gotchas.

## Why was it chosen?

- No external state library — runes work in components AND `.svelte.ts` modules, which the project uses for shared state.
- Scoped CSS by default — load-bearing here, since several components style what UnoCSS can't extract via scoped CSS (Button, Input).

## Related

- [sveltekit.md](./sveltekit.md) - Meta-framework
- [../ui/unocss.md](../ui/unocss.md) - Styling
- [../ui/bits-ui.md](../ui/bits-ui.md) - Component library
