import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import { providerConnection } from '../schema/ai/provider-connection';
import { user } from '../schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { listProviderConnections, removeProviderKey, saveProviderConnection, setDefaultProvider } = await import(
	'./provider-connections'
);
const { db } = await import('$lib/server/db');

const ADMIN = makeUser({ id: 'admin-1' });
const CIPHERTEXT = 'bm9uY2Vub25jZW5v:Y2lwaGVydGV4dC1ub3QtcGxhaW50ZXh0LXRhZ2dlZA==';

function pgCode(err: unknown): string | undefined {
	const e = err as { code?: string; cause?: { code?: string } };
	return e.code ?? e.cause?.code;
}

async function rowFor(provider: 'groq' | 'openai' | 'google') {
	const [row] = await db.select().from(providerConnection).where(eq(providerConnection.provider, provider));
	return row ?? null;
}

describe('provider connections', () => {
	beforeAll(async () => {
		await db.insert(user).values([ADMIN]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(providerConnection);
	});

	describe('saveProviderConnection', () => {
		it('inserts a first row at version 1 and stores only the ciphertext', async () => {
			const result = await saveProviderConnection(db, {
				provider: 'groq',
				enabled: true,
				modelId: 'openai/gpt-oss-120b',
				apiKeyCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});
			expect(result).toEqual({ ok: true, version: 1 });
			const row = await rowFor('groq');
			expect(row?.apiKeyCiphertext).toBe(CIPHERTEXT);
			expect(row?.updatedBy).toBe(ADMIN.id);
			expect(JSON.stringify(row)).not.toContain('gsk_');
		});

		it('reports a conflict when two tabs both insert the first row', async () => {
			const input = {
				provider: 'openai' as const,
				enabled: false,
				modelId: 'gpt-4o-mini',
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			};
			await saveProviderConnection(db, input);
			expect(await saveProviderConnection(db, input)).toEqual({ conflict: true });
		});

		it('rejects a stale version and leaves the saved row intact', async () => {
			await saveProviderConnection(db, {
				provider: 'google',
				enabled: true,
				modelId: 'gemini-2.5-flash',
				apiKeyCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});
			const stale = await saveProviderConnection(db, {
				provider: 'google',
				enabled: false,
				modelId: 'other',
				expectedVersion: 7,
				updatedBy: ADMIN.id,
			});
			expect(stale).toEqual({ conflict: true });
			const row = await rowFor('google');
			expect(row).toMatchObject({
				enabled: true,
				modelId: 'gemini-2.5-flash',
				version: 1,
				apiKeyCiphertext: CIPHERTEXT,
			});
		});

		it('keeps the stored key when none is supplied, replaces it when one is, and clears it on null', async () => {
			await saveProviderConnection(db, {
				provider: 'groq',
				enabled: true,
				modelId: 'a',
				apiKeyCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});

			const kept = await saveProviderConnection(db, {
				provider: 'groq',
				enabled: true,
				modelId: 'b',
				expectedVersion: 1,
				updatedBy: ADMIN.id,
			});
			expect(kept).toEqual({ ok: true, version: 2 });
			expect((await rowFor('groq'))?.apiKeyCiphertext).toBe(CIPHERTEXT);

			const replaced = await saveProviderConnection(db, {
				provider: 'groq',
				enabled: true,
				modelId: 'b',
				apiKeyCiphertext: 'bm9uY2U=:bmV3',
				expectedVersion: 2,
				updatedBy: ADMIN.id,
			});
			expect(replaced).toEqual({ ok: true, version: 3 });
			expect((await rowFor('groq'))?.apiKeyCiphertext).toBe('bm9uY2U=:bmV3');

			const cleared = await removeProviderKey(db, { provider: 'groq', expectedVersion: 3, updatedBy: ADMIN.id });
			expect(cleared).toEqual({ ok: true, version: 4 });
			expect((await rowFor('groq'))?.apiKeyCiphertext).toBeNull();
		});

		it('rejects an empty model id at the database', async () => {
			await expect(
				saveProviderConnection(db, {
					provider: 'groq',
					enabled: false,
					modelId: '',
					expectedVersion: 0,
					updatedBy: ADMIN.id,
				}),
			).rejects.toSatisfy((err) => pgCode(err) === '23514');
		});
	});

	describe('constraints', () => {
		it('refuses a default that is disabled or keyless', async () => {
			await expect(
				db
					.insert(providerConnection)
					.values({ provider: 'groq', enabled: false, modelId: 'm', apiKeyCiphertext: CIPHERTEXT, isDefault: true }),
			).rejects.toSatisfy((err) => pgCode(err) === '23514');
			await expect(
				db
					.insert(providerConnection)
					.values({ provider: 'groq', enabled: true, modelId: 'm', apiKeyCiphertext: null, isDefault: true }),
			).rejects.toSatisfy((err) => pgCode(err) === '23514');
		});

		it('allows at most one default', async () => {
			await db
				.insert(providerConnection)
				.values({ provider: 'groq', enabled: true, modelId: 'm', apiKeyCiphertext: CIPHERTEXT, isDefault: true });
			await expect(
				db
					.insert(providerConnection)
					.values({ provider: 'openai', enabled: true, modelId: 'm', apiKeyCiphertext: CIPHERTEXT, isDefault: true }),
			).rejects.toSatisfy((err) => pgCode(err) === '23505');
		});
	});

	describe('setDefaultProvider', () => {
		beforeEach(async () => {
			await db.insert(providerConnection).values([
				{ provider: 'groq', enabled: true, modelId: 'm', apiKeyCiphertext: CIPHERTEXT, isDefault: true },
				{ provider: 'openai', enabled: true, modelId: 'm', apiKeyCiphertext: CIPHERTEXT },
				{ provider: 'google', enabled: false, modelId: 'm', apiKeyCiphertext: CIPHERTEXT },
			]);
		});

		it('moves the default and bumps both rows', async () => {
			expect(
				await setDefaultProvider(db, { provider: 'openai', expectedCurrentDefault: 'groq', updatedBy: ADMIN.id }),
			).toEqual({ ok: true });
			expect(await rowFor('groq')).toMatchObject({ isDefault: false, version: 2 });
			expect(await rowFor('openai')).toMatchObject({ isDefault: true, version: 2 });
		});

		it('returns to Automatic', async () => {
			expect(
				await setDefaultProvider(db, { provider: null, expectedCurrentDefault: 'groq', updatedBy: ADMIN.id }),
			).toEqual({ ok: true });
			const rows = await listProviderConnections(db);
			expect(rows.every((r) => !r.isDefault)).toBe(true);
		});

		it('rejects a stale view of the current default without changing anything', async () => {
			expect(
				await setDefaultProvider(db, { provider: 'openai', expectedCurrentDefault: null, updatedBy: ADMIN.id }),
			).toEqual({ conflict: true });
			expect(await rowFor('groq')).toMatchObject({ isDefault: true, version: 1 });
		});

		it('refuses an unusable target and keeps the previous default', async () => {
			expect(
				await setDefaultProvider(db, { provider: 'google', expectedCurrentDefault: 'groq', updatedBy: ADMIN.id }),
			).toEqual({ unusable: true });
			expect(await rowFor('groq')).toMatchObject({ isDefault: true, version: 1 });
			expect(await rowFor('google')).toMatchObject({ isDefault: false, version: 1 });
		});
	});
});
