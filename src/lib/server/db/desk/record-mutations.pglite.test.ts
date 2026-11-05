import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addAttribute,
	coreAttributeKinds,
	createAttributeEngine,
	emptyAttributeRecord,
	serializeAttributeRecord,
	setAttributeValue,
} from '#lib/dynamic-attributes/index.ts';
import { makeUser } from '#lib/server/test/fixtures.ts';
import { user } from '../schema/auth/_better-auth';
import { file } from '../schema/desk/file';
import { deskRecord } from '../schema/desk/record';
import { fileRevision } from '../schema/desk/revision';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createRecordFile, updateRecordByFileId, deleteFile, restoreFile } = await import('./mutations');
const { getRecordByFileId } = await import('./queries');
const { db } = await import('#lib/server/db/index.ts');

const OWNER = makeUser({ id: 'owner-rec' });
const OTHER = makeUser({ id: 'other-rec' });
const engine = createAttributeEngine(coreAttributeKinds);

/** A record with one text attribute holding `value`. */
function recordWith(label: string, value: string) {
	const added = addAttribute(emptyAttributeRecord(), { label }, engine);
	if (!added.ok) throw new Error(added.refusal);
	const set = setAttributeValue(added.record, added.attributeId, value, engine);
	if (!set.ok) throw new Error(set.refusal);
	return set.record;
}

async function created() {
	const result = await createRecordFile(OWNER.id, 'Asset');
	if (result.status !== 'created') throw new Error('not created');
	return result.file.id;
}

describe('desk record persistence', () => {
	beforeAll(async () => {
		await db.insert(user).values([OWNER, OTHER]);
	});
	afterAll(async () => {
		await testClient?.close();
	});
	beforeEach(async () => {
		await db.delete(fileRevision);
		await db.delete(deskRecord);
		await db.delete(file);
	});

	it('creates an empty record and restores exactly what was saved, unicode and unknown kinds included', async () => {
		const fileId = await created();
		expect(await getRecordByFileId(fileId, OWNER.id)).toMatchObject({
			file: { type: 'record', name: 'Asset' },
			record: { document: emptyAttributeRecord(), version: 0 },
		});
		const document = recordWith('Spezies 🧬 "quoted"', 'Mensch — <b>not html</b>');
		// A kind this server does not know: kept byte for byte through JSONB.
		document.attributes.push({
			id: 'att_00000000ff',
			label: 'Rating',
			kind: 'app.rating',
			value: { stars: 4 },
			config: { max: 5 },
		});
		expect(await updateRecordByFileId(fileId, OWNER.id, { document, expectedVersion: 0 })).toMatchObject({
			status: 'saved',
			version: 1,
		});
		const loaded = await getRecordByFileId(fileId, OWNER.id);
		expect(loaded?.record.version).toBe(1);
		expect(serializeAttributeRecord(loaded?.record.document as never)).toBe(serializeAttributeRecord(document));
	});

	it('refuses a stale write without changing content or history', async () => {
		const fileId = await created();
		await updateRecordByFileId(fileId, OWNER.id, { document: recordWith('A', 'first'), expectedVersion: 0 });
		const stale = await updateRecordByFileId(fileId, OWNER.id, {
			document: recordWith('A', 'second'),
			expectedVersion: 0,
		});
		expect(stale).toEqual({ status: 'conflict' });
		const loaded = await getRecordByFileId(fileId, OWNER.id);
		expect(loaded?.record.document.attributes[0].value).toBe('first');
		expect(await db.select().from(fileRevision).where(eq(fileRevision.fileId, fileId))).toHaveLength(1);
	});

	it('keeps a pre-image of every overwrite and of a delete, and restores a deleted record', async () => {
		const fileId = await created();
		await updateRecordByFileId(fileId, OWNER.id, { document: recordWith('A', 'one'), expectedVersion: 0 });
		await updateRecordByFileId(fileId, OWNER.id, { document: recordWith('A', 'two'), expectedVersion: 1 });
		const deleted = await deleteFile(fileId, OWNER.id);
		expect(await getRecordByFileId(fileId, OWNER.id)).toBeNull();
		const revisions = await db.select().from(fileRevision).where(eq(fileRevision.fileId, fileId));
		expect(revisions.map((r) => [r.reason, r.fileType])).toEqual([
			['overwrite', 'record'],
			['overwrite', 'record'],
			['delete', 'record'],
		]);
		const restored = await restoreFile(fileId, OWNER.id, deleted?.updatedAt as Date);
		expect(restored?.status).toBe('restored');
		expect((await getRecordByFileId(fileId, OWNER.id))?.record.document.attributes[0].value).toBe('two');
	});

	it('never reads or writes another user’s record', async () => {
		const fileId = await created();
		expect(await getRecordByFileId(fileId, OTHER.id)).toBeNull();
		expect(
			await updateRecordByFileId(fileId, OTHER.id, { document: recordWith('X', 'y'), expectedVersion: 0 }),
		).toBeNull();
		expect((await getRecordByFileId(fileId, OWNER.id))?.record.version).toBe(0);
	});

	it('refuses an invalid or hostile document before taking any lock', async () => {
		const fileId = await created();
		for (const document of [
			{
				format: 1,
				attributes: [{ id: 'att_0000000001', label: 'x', kind: 'number', value: 'NaN', config: {} }],
				removed: [],
			},
			{ format: 2, attributes: [], removed: [] },
			JSON.parse('{"format":1,"attributes":[],"removed":[],"__proto__":{"admin":true}}'),
			{
				format: 1,
				attributes: [{ id: 'att_0000000001', label: 'a\u0000b', kind: 'text', value: '', config: {} }],
				removed: [],
			},
		]) {
			const result = await updateRecordByFileId(fileId, OWNER.id, { document, expectedVersion: 0 });
			expect(result?.status).toBe('invalid');
		}
		expect((await getRecordByFileId(fileId, OWNER.id))?.record.version).toBe(0);
	});
});
