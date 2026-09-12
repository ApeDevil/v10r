import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProviderConnectionRow } from '$lib/server/db/schema/ai/provider-connection';
import { encryptAesGcm } from '$lib/server/security/aes-gcm';
import {
	embeddingStatusFrom,
	publicProviderConnection,
	resolveEmbeddingConnection,
	resolveProviderRegistry,
	SUGGESTED_MODEL_IDS,
} from './connections';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const OTHER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const PLAINTEXT = 'gsk_live_plaintext_never_serialized';

function row(
	overrides: Partial<ProviderConnectionRow> & { provider: ProviderConnectionRow['provider'] },
): ProviderConnectionRow {
	return {
		enabled: true,
		modelId: 'model-x',
		apiKeyCiphertext: null,
		isDefault: false,
		version: 3,
		updatedAt: new Date('2026-09-11T10:00:00Z'),
		updatedBy: 'admin-1',
		...overrides,
	};
}

describe('resolveProviderRegistry', () => {
	it('shows every provider as unconfigured with its suggested model when nothing is saved', async () => {
		const registry = await resolveProviderRegistry([], KEY);
		expect(registry.entries.map((e) => e.id)).toEqual(['groq', 'openai', 'google']);
		for (const entry of registry.entries) {
			expect(entry).toMatchObject({
				enabled: false,
				keyStatus: 'none',
				configured: false,
				version: 0,
				isDefault: false,
			});
			expect(entry.modelId).toBe(SUGGESTED_MODEL_IDS[entry.id]);
			expect(entry.getInstance()).toBeNull();
		}
		expect(registry.defaultProviderId).toBeNull();
		expect(registry.degraded).toBe(false);
	});

	it('opens a stored key and derives capabilities from the saved model', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry(
			[row({ provider: 'openai', modelId: 'gpt-4o-mini', apiKeyCiphertext: ciphertext, isDefault: true })],
			KEY,
		);
		const openai = registry.entries.find((e) => e.id === 'openai');
		expect(openai).toMatchObject({ configured: true, keyStatus: 'ready', version: 3, isDefault: true });
		expect(openai?.capabilities).toEqual({ tools: true, vision: true, recognized: true });
		expect(openai?.getInstance()).not.toBeNull();
		expect(registry.defaultProviderId).toBe('openai');
	});

	it('marks a key that will not decrypt as undecryptable and the registry as degraded', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry(
			[row({ provider: 'google', apiKeyCiphertext: ciphertext, isDefault: true })],
			OTHER_KEY,
		);
		const google = registry.entries.find((e) => e.id === 'google');
		expect(google).toMatchObject({ keyStatus: 'undecryptable', configured: false, isDefault: true });
		expect(google?.getInstance()).toBeNull();
		expect(registry.degraded).toBe(true);
		expect(registry.defaultProviderId).toBeNull();
	});

	it('treats a missing encryption key as undecryptable, never as empty', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry([row({ provider: 'groq', apiKeyCiphertext: ciphertext })], null);
		expect(registry.entries[0]).toMatchObject({ keyStatus: 'undecryptable', configured: false });
		expect(registry.degraded).toBe(true);
	});

	it('leaves a disabled provider unconfigured even with a good key', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry(
			[row({ provider: 'groq', enabled: false, apiKeyCiphertext: ciphertext })],
			KEY,
		);
		expect(registry.entries[0]).toMatchObject({ enabled: false, keyStatus: 'ready', configured: false });
	});
});

describe('resolveEmbeddingConnection', () => {
	it('reports why Google cannot embed', async () => {
		expect(await resolveEmbeddingConnection([], KEY)).toEqual({ unavailable: 'disabled' });
		expect(await resolveEmbeddingConnection([row({ provider: 'google', enabled: false })], KEY)).toEqual({
			unavailable: 'disabled',
		});
		expect(await resolveEmbeddingConnection([row({ provider: 'google' })], KEY)).toEqual({ unavailable: 'no_key' });
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		expect(
			await resolveEmbeddingConnection([row({ provider: 'google', apiKeyCiphertext: ciphertext })], OTHER_KEY),
		).toEqual({
			unavailable: 'undecryptable',
		});
	});

	it('yields the key regardless of which provider is the generation default', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const rows = [
			row({ provider: 'groq', apiKeyCiphertext: ciphertext, isDefault: true }),
			row({ provider: 'google', apiKeyCiphertext: ciphertext }),
		];
		expect(await resolveEmbeddingConnection(rows, KEY)).toEqual({ apiKey: PLAINTEXT });
		expect(embeddingStatusFrom(await resolveProviderRegistry(rows, KEY))).toBe('ready');
	});
});

describe('registry.embeddingConnection', () => {
	// One row read + one decrypt per request: the registry the guard loaded already opened
	// the Google key, so the embed path takes the connection from it instead of reading the
	// rows again. Same rules as the row-path resolver the scripts use.
	it('opens the Google key once for the request and never serializes it', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry(
			[
				row({ provider: 'groq', apiKeyCiphertext: ciphertext, isDefault: true }),
				row({ provider: 'google', apiKeyCiphertext: ciphertext }),
			],
			KEY,
		);
		expect(registry.embeddingConnection()).toEqual({ apiKey: PLAINTEXT });
		const serialized = JSON.stringify(registry);
		expect(serialized).not.toContain(PLAINTEXT);
		expect(serialized).not.toContain('embeddingConnection');
	});

	it('reports the same unavailability reasons as resolveEmbeddingConnection', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const cases: Array<[ProviderConnectionRow[], string | null]> = [
			[[], KEY],
			[[row({ provider: 'google', enabled: false })], KEY],
			[[row({ provider: 'google' })], KEY],
			[[row({ provider: 'google', apiKeyCiphertext: ciphertext })], OTHER_KEY],
			[[row({ provider: 'google', apiKeyCiphertext: ciphertext })], null],
		];
		for (const [rows, encryptionKey] of cases) {
			expect((await resolveProviderRegistry(rows, encryptionKey)).embeddingConnection()).toEqual(
				await resolveEmbeddingConnection(rows, encryptionKey),
			);
		}
	});
});

describe('publicProviderConnection', () => {
	it('carries neither the plaintext, the ciphertext, nor the model closure', async () => {
		const ciphertext = await encryptAesGcm(PLAINTEXT, KEY);
		const registry = await resolveProviderRegistry([row({ provider: 'groq', apiKeyCiphertext: ciphertext })], KEY);
		const projection = publicProviderConnection(registry.entries[0] as (typeof registry.entries)[number]);
		const serialized = JSON.stringify(projection);
		expect(serialized).not.toContain(PLAINTEXT);
		expect(serialized).not.toContain(ciphertext);
		expect(serialized).not.toContain('getInstance');
		expect(projection).toMatchObject({
			provider: 'groq',
			hasKey: true,
			keyStatus: 'ready',
			configured: true,
			version: 3,
		});
		expect(projection.updatedAt).toBe('2026-09-11T10:00:00.000Z');
	});
});

/**
 * The bare-Bun ingest scripts import these leaves by relative path and cannot resolve
 * Vite aliases; a `$lib`/`$env`/`$app` import anywhere in their closure breaks
 * `db:ingest-docs` at startup. Type-only imports are erased and do not count.
 */
describe('script reachability', () => {
	const ROOTS = ['src/lib/server/ai/connections.ts', 'src/lib/server/db/ai/provider-connections.ts'];
	const IMPORT_RE = /^(?:import|export)\s+(type\s+)?[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/gm;

	function walk(file: string, seen = new Map<string, string[]>()): Map<string, string[]> {
		if (seen.has(file)) return seen;
		const source = readFileSync(file, 'utf8');
		const offenders: string[] = [];
		for (const match of source.matchAll(IMPORT_RE)) {
			const [, typeOnly, specifier] = match as unknown as [string, string | undefined, string];
			if (typeOnly) continue;
			if (specifier.startsWith('$')) offenders.push(specifier);
			if (specifier.startsWith('.')) {
				const target = resolve(dirname(file), specifier);
				const candidate = existsSync(`${target}.ts`) ? `${target}.ts` : `${target}/index.ts`;
				walk(candidate, seen);
			}
		}
		if (/import\.meta\b/.test(source)) offenders.push('import.meta');
		seen.set(file, offenders);
		return seen;
	}

	it('keeps the closure of the script-facing leaves free of Vite aliases', () => {
		for (const root of ROOTS) {
			const closure = walk(resolve(process.cwd(), root));
			const violations = [...closure].filter(([, offenders]) => offenders.length > 0);
			expect(violations, `${root} reaches an alias import`).toEqual([]);
		}
	});
});
