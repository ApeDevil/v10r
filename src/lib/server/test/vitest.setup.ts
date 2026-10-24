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
// Same for `abuse/config.ts`: under vitest `dev` is false, so importing it runs the
// production assertion (32+ chars, no placeholder-looking prefix). Without this the suite
// passed only where a real .env was injected — a clean CI checkout failed.
process.env.ALTCHA_HMAC_KEY ||= 'vitest-altcha-hmac-key-at-least-32-characters';

// Hermeticity tripwire: every suite mocks its remote (PGlite for Postgres,
// injected fakes for Redis, vi.mock for Neo4j/R2), so no test may ever reach a
// live service. Erasing the inherited credentials turns an accidental real
// connection into a loud failure instead of a silent write to prod.
for (const key of [
	'NEON_DATABASE_URL_PROD',
	'NEO4J_URI',
	'NEO4J_USERNAME',
	'NEO4J_PASSWORD',
	'UPSTASH_REDIS_REST_URL',
	'UPSTASH_REDIS_REST_TOKEN',
	'EXTERNAL_SERVICE_LOCAL_URL',
	'EXTERNAL_SERVICE_LOCAL_TOKEN',
	'EXTERNAL_SERVICE_REMOTE_URL',
	'EXTERNAL_SERVICE_REMOTE_TOKEN',
]) {
	delete process.env[key];
}

// SvelteKit's `$app/env/private` holds the values it validated at start-up; under test every
// declared variable reads `process.env` live instead, so a case can set or delete one.
vi.mock('$app/env/private', async () => (await import('./env-mock.ts')).envModule((name) => process.env[name]));

// Mock $app/env
vi.mock('$app/env', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test',
}));
