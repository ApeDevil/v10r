/**
 * CSV export hardening: values that open a formula in spreadsheet software
 * (leading =, +, -, @) must be neutralized — detail fields carry
 * user-controlled strings (e.g. passkey names).
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { adminAuditLog } from '$lib/server/db/schema/admin';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { exportAuditLogCsv } = await import('./audit');

afterAll(async () => {
	await testClient?.close();
});

describe('exportAuditLogCsv', () => {
	it('neutralizes formula-injection payloads', async () => {
		await db.insert(adminAuditLog).values({
			action: 'passkey.renamed',
			actorId: 'usr_1',
			actorEmail: '=HYPERLINK("http://evil.example")',
			targetType: 'auth.user',
			targetId: '@usr_1',
			detail: { name: '=cmd|/c calc' },
		});

		const csv = await exportAuditLogCsv();
		const dataLine = csv.split('\n')[1];

		// Every formula-leading value is prefixed with a quote
		expect(dataLine).toContain(`'=HYPERLINK`);
		expect(dataLine).toContain(`'@usr_1`);
		// The detail JSON itself starts with { — not formula-leading — but a
		// raw unprefixed =cmd must never start a CSV field.
		for (const field of dataLine.split(',')) {
			expect(field.startsWith('=')).toBe(false);
			expect(field.startsWith('+')).toBe(false);
			expect(field.startsWith('@')).toBe(false);
		}
	});
});
