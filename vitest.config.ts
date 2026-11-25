import { sveltekit } from '@sveltejs/kit/vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { a2uiZodDedupe } from './scripts/build/a2ui-zod-dedupe.ts';

/**
 * Two lanes, because they have nothing in common but the runner.
 *
 * `unit` is pure computation and keeps vitest's 5s default: a test there that needs
 * longer is a database test that forgot its `.pglite.` suffix, and the timeout is the
 * second detector behind the naming gate (`naming.gate.test.ts`).
 *
 * `db` restores a PGlite datadir snapshot per file — see `test/pglite-schema.setup.ts`
 * for why a snapshot rather than a rebuild, with the measurements.
 */
const PGLITE = 'src/**/*.pglite.test.ts';

const shared = {
	environment: 'node' as const,
	globals: true,
	setupFiles: ['src/lib/server/test/vitest.setup.ts'],
	passWithNoTests: true,
};

export default defineConfig({
	test: {
		projects: [
			{
				// The zod resolution the app build uses, so web_core is tested as it ships.
				plugins: [a2uiZodDedupe(), sveltekit()],
				test: {
					...shared,
					name: 'unit',
					// Inlined so its imports go through the resolver above instead of Node's.
					server: { deps: { inline: [/\/node_modules\/@a2ui\/web_core\//] } },
					include: ['src/**/*.test.ts', 'pattern-library/**/*.test.ts', 'scripts/agentic/**/*.test.ts'],
					// `exclude` REPLACES vitest's defaults — spread them back or node_modules is scanned.
					exclude: [...configDefaults.exclude, PGLITE],
				},
			},
			{
				plugins: [sveltekit()],
				test: {
					...shared,
					name: 'db',
					include: [PGLITE],
					globalSetup: ['src/lib/server/test/pglite-schema.setup.ts'],
					// Restoring a snapshot is ~294ms, but the pool still competes for CPU. Kept
					// generous, and deliberately equal: raising only `testTimeout` leaves hooks on
					// the 10s default, and the identical `createTestDb()` call then passes inside
					// `it()` and times out inside `beforeAll()`.
					testTimeout: 30_000,
					hookTimeout: 30_000,
				},
			},
		],
	},
});
