# Valibot

The validation library — modular, tree-shakeable, functional composition via pipes. See the `valibot-superforms` skill for schema syntax.

## Why was it chosen?

- ~1.4 KB vs Zod's ~13.5 KB, only bundling the validators used — keeps client bundles small.

## Superforms integration

- Native Valibot adapter (`sveltekit-superforms/adapters`), automatic FormData coercion.
- Schema must be defined at module top-level for caching.

## Known limitations

- No method chaining — functional composition instead (`v.parse(schema, data)`, not `schema.parse(data)`).
- `@valibot/to-json-schema` does not support `transform` actions.

## Related

- [superforms.md](./superforms.md) - Form handling
- [../core/sveltekit.md](../core/sveltekit.md) - Server validation
