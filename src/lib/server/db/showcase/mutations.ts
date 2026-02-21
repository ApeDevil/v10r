/**
 * Showcase mutation operations.
 * All database writes for the interactive showcase pages live here.
 * Action handlers in +page.server.ts are thin — they parse FormData and call these.
 */
import { db } from '$lib/server/db';
import {
	typeSpecimen,
	typeSpecimenHistory,
	documentVault,
	auditLog,
	temporalRecord,
} from '$lib/server/db/schema';
import { eq, sql, and, lte, or, isNull, gt, desc, max } from 'drizzle-orm';

// ─── Mutable CRUD ──────────────────────────────────────────────

export async function createSpecimen(data: {
	label: string;
	code: string;
	rating?: number;
	quantity?: number;
	isActive?: boolean;
}) {
	const [row] = await db
		.insert(typeSpecimen)
		.values({
			label: data.label,
			code: data.code,
			rating: data.rating ?? null,
			quantity: data.quantity ?? 0,
			isActive: data.isActive ?? true,
		})
		.returning();

	// Also insert initial history entry
	await db.insert(typeSpecimenHistory).values({
		specimenId: row.id,
		version: 1,
		label: row.label,
		code: row.code,
		rating: row.rating,
		quantity: row.quantity,
		price: row.price,
		isActive: row.isActive,
		changedBy: 'showcase-user',
		changeType: 'create',
	});

	return row;
}

export async function updateSpecimen(
	id: number,
	data: {
		label?: string;
		rating?: number;
		quantity?: number;
		isActive?: boolean;
	},
) {
	const [row] = await db
		.update(typeSpecimen)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(typeSpecimen.id, id))
		.returning();
	return row;
}

export async function deleteSpecimen(id: number) {
	// History cascade handles cleanup
	const [row] = await db
		.delete(typeSpecimen)
		.where(eq(typeSpecimen.id, id))
		.returning();
	return row;
}

// ─── Versioned Records ─────────────────────────────────────────

export async function updateWithHistory(
	id: number,
	data: {
		label?: string;
		rating?: number;
		quantity?: number;
		isActive?: boolean;
	},
) {
	// Get current max version for this specimen
	const [versionResult] = await db
		.select({ maxVersion: max(typeSpecimenHistory.version) })
		.from(typeSpecimenHistory)
		.where(eq(typeSpecimenHistory.specimenId, id));

	const nextVersion = (versionResult?.maxVersion ?? 0) + 1;

	// Update the specimen
	const [updated] = await db
		.update(typeSpecimen)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(typeSpecimen.id, id))
		.returning();

	if (!updated) return null;

	// Insert history snapshot
	await db.insert(typeSpecimenHistory).values({
		specimenId: updated.id,
		version: nextVersion,
		label: updated.label,
		code: updated.code,
		rating: updated.rating,
		quantity: updated.quantity,
		price: updated.price,
		isActive: updated.isActive,
		changedBy: 'showcase-user',
		changeType: 'update',
	});

	return { specimen: updated, version: nextVersion };
}

// ─── Soft Delete ────────────────────────────────────────────────

export async function softDeleteDocument(id: string) {
	const [doc] = await db
		.update(documentVault)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(documentVault.id, id))
		.returning();
	return doc;
}

export async function restoreDocument(id: string) {
	const [doc] = await db
		.update(documentVault)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(eq(documentVault.id, id))
		.returning();
	return doc;
}

// ─── Append-Only ────────────────────────────────────────────────

export async function appendAuditEntry(data: {
	action: 'create' | 'update' | 'delete' | 'restore' | 'export' | 'import' | 'login' | 'logout';
	severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
	description: string;
}) {
	const [entry] = await db
		.insert(auditLog)
		.values({
			action: data.action,
			severity: data.severity,
			description: data.description,
			actorId: 'showcase-user',
		})
		.returning();
	return entry;
}

// ─── Temporal ───────────────────────────────────────────────────

export async function queryTemporalAt(date: string) {
	const rows = await db
		.select()
		.from(temporalRecord)
		.where(
			and(
				lte(temporalRecord.validFrom, new Date(date)),
				or(
					isNull(temporalRecord.validTo),
					gt(temporalRecord.validTo, new Date(date)),
				),
			),
		)
		.orderBy(desc(temporalRecord.validFrom));
	return rows;
}

export async function addTemporalRecord(data: {
	description: string;
	validFrom: string;
	validTo?: string;
}) {
	const [row] = await db
		.insert(temporalRecord)
		.values({
			description: data.description,
			validFrom: new Date(data.validFrom),
			validTo: data.validTo ? new Date(data.validTo) : null,
		})
		.returning();
	return row;
}
