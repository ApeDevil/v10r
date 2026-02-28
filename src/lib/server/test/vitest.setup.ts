import { vi } from 'vitest';

// Prevent job schedulers from starting setInterval during tests
globalThis.__v10r_scheduler = 'test' as never;
globalThis.__v10r_delivery_scheduler = 'test' as never;

// Mock SvelteKit $env/dynamic/private — redirects to process.env
// https://github.com/sveltejs/kit/issues/9564
vi.mock('$env/dynamic/private', () => ({
	env: new Proxy(
		{},
		{
			get: (_target, prop: string) => process.env[prop],
		},
	),
}));

// Mock SvelteKit $env/static/private — same redirect
vi.mock('$env/static/private', () =>
	new Proxy(
		{},
		{
			get: (_target, prop: string) => process.env[prop],
		},
	),
);

// Mock $app/environment
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test',
}));
