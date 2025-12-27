# Valibot

## What is it?

TypeScript schema validation library designed for minimal bundle size. Built from many small, independent functions enabling aggressive tree-shaking. Zero dependencies, runs in any JavaScript environment.

## What is it for?

- Schema validation for server-side data (API endpoints, database inputs)
- Client-side form validation (SvelteKit, React, Vue)
- Configuration file validation
- Runtime type guarantees for unknown data structures

## Why was it chosen?

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle size | **~1.4 KB** | ~13.5 KB |
| Tree-shaking | Modular (only imports) | Monolithic |
| Performance | ~2x faster | Baseline |
| TypeScript | Full inference | Full inference |

**Bundle impact:** Login form example: Valibot 1.37 KB vs Zod 13.5 KB (90% reduction)

**Key advantages:**
- Simplest schemas start at <300 bytes
- Functional composition with pipes (`pipe(string(), email(), minLength(5))`)
- Modular imports (only bundles used validators)
- Full TypeScript inference (no codegen)
- Composable schemas (build complex from simple)
- Custom error messages (i18n-friendly)

**Superforms integration:**
- Native Valibot adapter (`sveltekit-superforms/adapters`)
- Automatic FormData coercion
- Schema must be defined at module top-level for caching

## Known limitations

**Ecosystem maturity:**
- ~1 year old (newer than Zod/Yup)
- Smaller community; support primarily via GitHub discussions
- Growing library support (Superforms, NestJS, Drizzle) but not as comprehensive as Zod

**Documentation:**
- Identified as "biggest blocker" for adoption
- API reference finalized with 600+ pages (recent improvement)
- Still considered risky for large production projects

**API differences from Zod:**
- No method chaining (functional composition instead)
- `v.parse(schema, data)` instead of `schema.parse(data)`
- Single string error format vs Zod's differentiated messages
- No `coerce` object (requires explicit transform)
- Migration codemod available but in beta

**JSON Schema:**
- `@valibot/to-json-schema` available
- Does not support `transform` actions (limits practical use)

## Related

- [superforms.md](./superforms.md) - Form handling
- [../core/sveltekit.md](../core/sveltekit.md) - Server validation
