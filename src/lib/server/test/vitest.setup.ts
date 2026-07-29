import { vi } from 'vitest';

// Prevent job schedulers from starting setInterval during tests
globalThis.__v10r_scheduler = 'test' as never;
globalThis.__v10r_delivery_scheduler = 'test' as never;

// `security/subkey.ts` derives per-purpose MAC keys from BETTER_AUTH_SECRET and
// throws when it is absent — deliberately, since it cannot be absent in a
// served request (auth/index.ts validates it at module load). Guarantee it here
// so every suite that transitively reaches a keyed hash or a signed ticket gets
// the real code path instead of per-test boilerplate. Only a fallback: a real
// value in the environment still wins.
process.env.BETTER_AUTH_SECRET ||= 'vitest-better-auth-secret-at-least-32-characters';

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
vi.mock(
	'$env/static/private',
	() =>
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
