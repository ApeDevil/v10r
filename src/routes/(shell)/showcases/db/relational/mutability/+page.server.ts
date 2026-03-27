import { fail } from '@sveltejs/kit';
import { desc, isNotNull, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	auditLog,
	documentVault,
	networkRegistry,
	temporalRecord,
	typeSpecimen,
	typeSpecimenHistory,
} from '$lib/server/db/schema';
import { checkRowLimit } from '$lib/server/db/showcase/guards';
import {
	addTemporalRecord,
	appendAuditEntry,
	createSpecimen,
	deleteSpecimen,
	queryTemporalAt,
	restoreDocument,
	softDeleteDocument,
	updateSpecimen,
	updateWithHistory,
} from '$lib/server/db/showcase/mutations';
import { reseedShowcase } from '$lib/server/db/showcase/seed';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [mutableRows, versionHistory, activeDocuments, deletedDocuments, appendLog, temporalRows] = await Promise.all(
			[
				db.select().from(typeSpecimen).orderBy(desc(typeSpecimen.updatedAt)),
				db.select().from(typeSpecimenHistory).orderBy(desc(typeSpecimenHistory.changedAt)),
				db.select().from(documentVault).where(isNull(documentVault.deletedAt)),
				db.select().from(documentVault).where(isNotNull(documentVault.deletedAt)),
				db.select().from(auditLog).orderBy(desc(auditLog.occurredAt)).limit(15),
				db.select().from(temporalRecord).orderBy(desc(temporalRecord.validFrom)),
			],
		);

		// Also load append-only network registry
		const appendOnlyRecords = await db.select().from(networkRegistry).orderBy(desc(networkRegistry.registeredAt));

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			mutableRows,
			versionHistory,
			activeDocuments,
			deletedDocuments,
			appendLog,
			appendOnlyRecords,
			temporalRows,
			queryMs,
		};
	} catch (err) {
		return {
			mutableRows: [],
			versionHistory: [],
			activeDocuments: [],
			deletedDocuments: [],
			appendLog: [],
			appendOnlyRecords: [],
			temporalRows: [],
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	// ─── Mutable CRUD ──────────────────────────────────────────

	createSpecimen: async ({ request }) => {
		const formData = await request.formData();
		const label = formData.get('label');
		const code = formData.get('code');
		const rating = formData.get('rating');
		const quantity = formData.get('quantity');

		if (!label || !code) {
			return fail(400, { message: 'Label and Code are required.' });
		}

		const limitError = await checkRowLimit(typeSpecimen);
		if (limitError) return fail(400, { message: limitError });

		try {
			await createSpecimen({
				label: String(label),
				code: String(code),
				rating: rating ? Number(rating) : undefined,
				quantity: quantity ? Number(quantity) : undefined,
			});
			return { success: true, message: 'Specimen created.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to create specimen.',
			});
		}
	},

	updateSpecimen: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'Missing specimen ID.' });

		const label = formData.get('label');
		const rating = formData.get('rating');
		const quantity = formData.get('quantity');
		const isActive = formData.get('isActive');

		try {
			await updateSpecimen(Number(id), {
				...(label && { label: String(label) }),
				...(rating && { rating: Number(rating) }),
				...(quantity !== null && { quantity: Number(quantity) }),
				...(isActive !== null && { isActive: isActive === 'true' }),
			});
			return { success: true, message: 'Specimen updated.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to update specimen.',
			});
		}
	},

	deleteSpecimen: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'Missing specimen ID.' });

		try {
			await deleteSpecimen(Number(id));
			return { success: true, message: 'Specimen deleted.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to delete specimen.',
			});
		}
	},

	// ─── Versioned Records ─────────────────────────────────────

	updateWithHistory: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'Missing specimen ID.' });

		const label = formData.get('label');
		const rating = formData.get('rating');
		const quantity = formData.get('quantity');
		const isActive = formData.get('isActive');

		try {
			const result = await updateWithHistory(Number(id), {
				...(label && { label: String(label) }),
				...(rating && { rating: Number(rating) }),
				...(quantity !== null && { quantity: Number(quantity) }),
				...(isActive !== null && { isActive: isActive === 'true' }),
			});
			if (!result) return fail(404, { message: 'Specimen not found.' });
			return { success: true, message: `Updated to version ${result.version}.` };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to update specimen.',
			});
		}
	},

	// ─── Soft Delete ────────────────────────────────────────────

	softDelete: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'Missing document ID.' });

		try {
			await softDeleteDocument(String(id));
			return { success: true, message: 'Document soft-deleted.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to soft-delete.',
			});
		}
	},

	restore: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id');
		if (!id) return fail(400, { message: 'Missing document ID.' });

		try {
			await restoreDocument(String(id));
			return { success: true, message: 'Document restored.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to restore.',
			});
		}
	},

	// ─── Append-Only ────────────────────────────────────────────

	appendAuditEntry: async ({ request }) => {
		const formData = await request.formData();
		const action = formData.get('action');
		const severity = formData.get('severity');
		const description = formData.get('description');

		if (!action || !severity || !description) {
			return fail(400, { message: 'All fields are required.' });
		}

		const limitError = await checkRowLimit(auditLog);
		if (limitError) return fail(400, { message: limitError });

		try {
			await appendAuditEntry({
				action: String(action) as any,
				severity: String(severity) as any,
				description: String(description),
			});
			return { success: true, message: 'Audit entry appended.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to append entry.',
			});
		}
	},

	// ─── Temporal ───────────────────────────────────────────────

	addTemporalRecord: async ({ request }) => {
		const formData = await request.formData();
		const description = formData.get('description');
		const validFrom = formData.get('validFrom');
		const validTo = formData.get('validTo');

		if (!description || !validFrom) {
			return fail(400, { message: 'Description and Valid From are required.' });
		}

		const limitError = await checkRowLimit(temporalRecord);
		if (limitError) return fail(400, { message: limitError });

		try {
			await addTemporalRecord({
				description: String(description),
				validFrom: String(validFrom),
				validTo: validTo ? String(validTo) : undefined,
			});
			return { success: true, message: 'Temporal record added.' };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to add temporal record.',
			});
		}
	},

	temporalQuery: async ({ request }) => {
		const formData = await request.formData();
		const date = formData.get('date');

		if (!date) return fail(400, { message: 'Date is required.' });

		try {
			const results = await queryTemporalAt(String(date));
			return { success: true, temporalResults: results, queryDate: String(date) };
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Failed to query temporal records.',
			});
		}
	},

	// ─── Reset ──────────────────────────────────────────────────

	reseed: async () => {
		try {
			await reseedShowcase(db);
			return { success: true, message: 'Showcase data reset to seed values.' };
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to reseed.',
			});
		}
	},
};
