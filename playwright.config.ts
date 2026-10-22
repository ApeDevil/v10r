import { defineConfig } from '@playwright/test';

/**
 * Browser specs for interaction-heavy showcases (`docs/blueprint/testing/strategy.md`).
 * Not part of `validate`: run `bun run test:browser` against the dev server the container
 * already runs on 5173, or set PLAYWRIGHT_BASE_URL to point at another one.
 */
const external = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = external ?? 'http://localhost:5173';

export default defineConfig({
	testDir: 'tests/browser',
	// The first request compiles the route in the dev server; WebGL runs on SwiftShader.
	timeout: 180_000,
	expect: { timeout: 15_000 },
	workers: 1,
	// A flaky spec stays visible: no retries hide it.
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL,
		viewport: { width: 1440, height: 1000 },
		acceptDownloads: true,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: {
				browserName: 'chromium',
				// Headless Chromium has no GPU; SwiftShader gives WebGL only when explicitly allowed.
				launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
			},
		},
	],
	webServer: external
		? undefined
		: { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 240_000 },
});
