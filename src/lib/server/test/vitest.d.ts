declare module 'vitest' {
	interface ProvidedContext {
		/** Path to the datadir dump built once per run by `pglite-schema.setup.ts`. */
		pgliteSchemaDump: string;
		/** `search_path` covering every declared pgSchema namespace, derived alongside the dump. */
		pgliteSearchPath: string;
	}
}

export {};
