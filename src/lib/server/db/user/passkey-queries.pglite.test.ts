/**
 * Passkey DTO contracts:
 * 1. listPasskeyDtos never leaks credential internals — publicKey,
 *    credentialID, counter, and raw aaguid stay in the DB layer.
 * 2. The aaguid resolves to a human label (or null), never the raw value.
 * 3. countPasskeys and touchPasskeyLastUsed behave per user/credential.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { passkey } from '$lib/server/db/schema/auth/passkey';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { listPasskeyDtos, countPasskeys, touchPasskeyLastUsed } = await import('./queries');

afterAll(async () => {
	await testClient?.close();
});

const USER_ID = 'usr_passkey_test_1';
// Google Password Manager — present in the bundled aaguid label map.
const KNOWN_AAGUID = 'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4';

beforeEach(async () => {
	await db.delete(passkey);
	await db.delete(user);
	await db.insert(user).values({ id: USER_ID, name: 'Passkey Tester', email: 'passkey@example.com' });
	await db.insert(passkey).values({
		id: 'pk_1',
		name: 'Laptop',
		publicKey: 'PUBLIC_KEY_MATERIAL_abc123',
		userId: USER_ID,
		credentialID: 'CREDENTIAL_ID_xyz789',
		counter: 7,
		deviceType: 'multiDevice',
		backedUp: true,
		aaguid: KNOWN_AAGUID,
	});
});

describe('listPasskeyDtos', () => {
	it('projects out credential internals', async () => {
		const [dto] = await listPasskeyDtos(USER_ID);

		expect(dto).toBeDefined();
		const serialized = JSON.stringify(dto);
		expect(serialized).not.toContain('PUBLIC_KEY_MATERIAL');
		expect(serialized).not.toContain('CREDENTIAL_ID');
		expect(serialized).not.toContain(KNOWN_AAGUID);
		expect(dto).not.toHaveProperty('publicKey');
		expect(dto).not.toHaveProperty('credentialID');
		expect(dto).not.toHaveProperty('counter');
		expect(dto).not.toHaveProperty('aaguid');
	});

	it('resolves the aaguid to a display label', async () => {
		const [dto] = await listPasskeyDtos(USER_ID);
		expect(dto.name).toBe('Laptop');
		expect(dto.authenticatorLabel).toBe('Google Password Manager');
		expect(dto.deviceType).toBe('multiDevice');
		expect(dto.backedUp).toBe(true);
	});

	it('returns null label for unknown or absent aaguids', async () => {
		await db.insert(passkey).values({
			id: 'pk_2',
			publicKey: 'pk2_material',
			userId: USER_ID,
			credentialID: 'cred_2',
			counter: 0,
			deviceType: 'singleDevice',
			backedUp: false,
			aaguid: null,
		});
		const dtos = await listPasskeyDtos(USER_ID);
		const pk2 = dtos.find((d) => d.id === 'pk_2');
		expect(pk2?.authenticatorLabel).toBeNull();
	});
});

describe('countPasskeys / touchPasskeyLastUsed', () => {
	it('counts per user', async () => {
		expect(await countPasskeys(USER_ID)).toBe(1);
		expect(await countPasskeys('usr_other')).toBe(0);
	});

	it('stamps lastUsedAt by credentialID', async () => {
		expect((await listPasskeyDtos(USER_ID))[0].lastUsedAt).toBeNull();

		await touchPasskeyLastUsed('CREDENTIAL_ID_xyz789');

		const [dto] = await listPasskeyDtos(USER_ID);
		expect(dto.lastUsedAt).toBeInstanceOf(Date);
	});
});
