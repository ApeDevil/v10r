import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import type { NameSourceVendor } from '$lib/types/db-enums';
import { user } from '../schema/auth/_better-auth';
import { sourceConnection } from '../schema/name-check/source-connection';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { listNameSourceConnections, removeNameSourceSecret, saveNameSourceConnection } = await import(
	'./source-connections'
);
const { db } = await import('$lib/server/db');

const ADMIN = makeUser({ id: 'admin-1' });
const CIPHERTEXT = 'bm9uY2Vub25jZW5v:Y2lwaGVydGV4dC1ub3QtcGxhaW50ZXh0LXRhZ2dlZA==';
const NO_EUIPO_FIELDS = { clientId: null, apiBase: null, tokenUrl: null };

function pgCode(err: unknown): string | undefined {
	const e = err as { code?: string; cause?: { code?: string } };
	return e.code ?? e.cause?.code;
}

async function rowFor(vendor: NameSourceVendor) {
	const [row] = await db.select().from(sourceConnection).where(eq(sourceConnection.vendor, vendor));
	return row ?? null;
}

describe('name source connections', () => {
	beforeAll(async () => {
		await db.insert(user).values([ADMIN]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(sourceConnection);
	});

	describe('saveNameSourceConnection', () => {
		it('inserts a first row at version 1 and stores only the ciphertext', async () => {
			const result = await saveNameSourceConnection(db, {
				vendor: 'tavily',
				enabled: true,
				...NO_EUIPO_FIELDS,
				secretCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});
			expect(result).toEqual({ ok: true, version: 1 });
			const row = await rowFor('tavily');
			expect(row?.secretCiphertext).toBe(CIPHERTEXT);
			expect(row?.updatedBy).toBe(ADMIN.id);
			expect(JSON.stringify(row)).not.toContain('tvly-');
		});

		it('reports a conflict when two tabs both insert the first row', async () => {
			const input = {
				vendor: 'brave' as const,
				enabled: false,
				...NO_EUIPO_FIELDS,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			};
			await saveNameSourceConnection(db, input);
			expect(await saveNameSourceConnection(db, input)).toEqual({ conflict: true });
		});

		it('rejects a stale version and leaves the saved row intact', async () => {
			await saveNameSourceConnection(db, {
				vendor: 'euipo',
				enabled: true,
				clientId: 'app-1',
				apiBase: null,
				tokenUrl: null,
				secretCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});
			const stale = await saveNameSourceConnection(db, {
				vendor: 'euipo',
				enabled: false,
				clientId: 'app-2',
				apiBase: null,
				tokenUrl: null,
				expectedVersion: 7,
				updatedBy: ADMIN.id,
			});
			expect(stale).toEqual({ conflict: true });
			expect(await rowFor('euipo')).toMatchObject({
				enabled: true,
				clientId: 'app-1',
				version: 1,
				secretCiphertext: CIPHERTEXT,
			});
		});

		it('keeps the stored secret when none is supplied, replaces it when one is, and clears it on remove', async () => {
			await saveNameSourceConnection(db, {
				vendor: 'tavily',
				enabled: true,
				...NO_EUIPO_FIELDS,
				secretCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});

			const kept = await saveNameSourceConnection(db, {
				vendor: 'tavily',
				enabled: false,
				...NO_EUIPO_FIELDS,
				expectedVersion: 1,
				updatedBy: ADMIN.id,
			});
			expect(kept).toEqual({ ok: true, version: 2 });
			expect((await rowFor('tavily'))?.secretCiphertext).toBe(CIPHERTEXT);

			const replaced = await saveNameSourceConnection(db, {
				vendor: 'tavily',
				enabled: true,
				...NO_EUIPO_FIELDS,
				secretCiphertext: 'bm9uY2U=:bmV3',
				expectedVersion: 2,
				updatedBy: ADMIN.id,
			});
			expect(replaced).toEqual({ ok: true, version: 3 });
			expect((await rowFor('tavily'))?.secretCiphertext).toBe('bm9uY2U=:bmV3');

			const cleared = await removeNameSourceSecret(db, { vendor: 'tavily', expectedVersion: 3, updatedBy: ADMIN.id });
			expect(cleared).toEqual({ ok: true, version: 4 });
			expect((await rowFor('tavily'))?.secretCiphertext).toBeNull();
		});

		it('stores EUIPO hosts and lets null fall back to the defaults', async () => {
			await saveNameSourceConnection(db, {
				vendor: 'euipo',
				enabled: true,
				clientId: 'app-1',
				apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
				tokenUrl: 'https://auth-sandbox.euipo.europa.eu/oidc/accessToken',
				secretCiphertext: CIPHERTEXT,
				expectedVersion: 0,
				updatedBy: ADMIN.id,
			});
			expect(await rowFor('euipo')).toMatchObject({
				apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
				tokenUrl: 'https://auth-sandbox.euipo.europa.eu/oidc/accessToken',
			});
			await saveNameSourceConnection(db, {
				vendor: 'euipo',
				enabled: true,
				clientId: 'app-1',
				apiBase: null,
				tokenUrl: null,
				expectedVersion: 1,
				updatedBy: ADMIN.id,
			});
			expect(await rowFor('euipo')).toMatchObject({ apiBase: null, tokenUrl: null, version: 2 });
		});
	});

	describe('constraints', () => {
		it('refuses EUIPO-only fields on another vendor', async () => {
			await expect(
				saveNameSourceConnection(db, {
					vendor: 'brave',
					enabled: true,
					clientId: 'not-for-brave',
					apiBase: null,
					tokenUrl: null,
					expectedVersion: 0,
					updatedBy: ADMIN.id,
				}),
			).rejects.toSatisfy((err: unknown) => pgCode(err) === '23514');
		});

		it('refuses a plain-http EUIPO host', async () => {
			await expect(
				saveNameSourceConnection(db, {
					vendor: 'euipo',
					enabled: true,
					clientId: 'app-1',
					apiBase: 'http://api.euipo.europa.eu/trademark-search',
					tokenUrl: null,
					expectedVersion: 0,
					updatedBy: ADMIN.id,
				}),
			).rejects.toSatisfy((err: unknown) => pgCode(err) === '23514');
		});
	});

	it('lists every saved row', async () => {
		await saveNameSourceConnection(db, {
			vendor: 'tavily',
			enabled: true,
			...NO_EUIPO_FIELDS,
			expectedVersion: 0,
			updatedBy: ADMIN.id,
		});
		await saveNameSourceConnection(db, {
			vendor: 'brave',
			enabled: false,
			...NO_EUIPO_FIELDS,
			expectedVersion: 0,
			updatedBy: ADMIN.id,
		});
		const rows = await listNameSourceConnections(db);
		expect(rows.map((r) => r.vendor).sort()).toEqual(['brave', 'tavily']);
	});
});
