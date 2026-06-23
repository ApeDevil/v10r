# Superforms

The SvelteKit form layer — one Valibot schema validates on both server and client, with progressive enhancement. See the `valibot-superforms` skill for usage.

## Why was it chosen?

- Single source of truth — the same schema runs on server and client.
- Progressive enhancement by default — forms work without JS.

## Known limitations

- **Svelte 5:** v2.x uses Svelte stores, not runes — components mix store syntax (`$formData`) with runes (`$props()`). Runes support is planned for v3 (no date).
- Schema must be defined at module top-level (not inside load functions) for caching.
- Valibot peer dependency: 1.0.0+.

## Related

- [valibot.md](./valibot.md) - Schema validation
- [../ui/bits-ui.md](../ui/bits-ui.md) - Form components
