import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
		environment: 'node',
		globals: true,
		// The `*.pglite.test.ts` suites boot a PGlite WASM instance and push the full 437-statement
		// schema. That is ~1.2s alone, but 10-20s when 158 files compete for the pool — so these two
		// must stay equal. Raising only `testTimeout` leaves hooks on vitest's 10s default, and the
		// identical `createTestDb()` call then passes inside `it()` and times out inside `beforeAll()`.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		setupFiles: ['src/lib/server/test/vitest.setup.ts'],
		passWithNoTests: true,
	},
});
