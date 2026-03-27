import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
		environment: 'node',
		globals: true,
		testTimeout: 15_000,
		setupFiles: ['src/lib/server/test/vitest.setup.ts'],
		passWithNoTests: true,
	},
});
