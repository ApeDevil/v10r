import { and, count, desc, eq, gte, ilike, lt, lte, or } from 'drizzle-orm';
import { ADMIN_AUDIT_PAGE_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { adminAuditLog } from '$lib/server/db/schema/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditEventInput {
	actorId: string;
	actorEmail: string;
	action: string;
	targetType?: string;
	targetId?: string;
	detail?: Record<string, unknown>;
	ipAddress?: string;
}

export interface AuditLogFilters {
	action?: string;
	actorId?: string;
	targetType?: string;
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	pageSize?: number;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
	await db.insert(adminAuditLog).values({
		action: input.action,
		actorId: input.actorId,
		actorEmail: input.actorEmail,
		targetType: input.targetType,
		targetId: input.targetId,
		detail: input.detail,
		ipAddress: input.ipAddress,
	});
}

// ── Read ──────────────────────────────────────────────────────────────────────

function buildWhereClause(filters: AuditLogFilters) {
	const conditions = [];

	if (filters.action) {
		conditions.push(eq(adminAuditLog.action, filters.action));
	}
	if (filters.actorId) {
		conditions.push(ilike(adminAuditLog.actorEmail, `%${filters.actorId}%`));
	}
	if (filters.targetType) {
		conditions.push(eq(adminAuditLog.targetType, filters.targetType));
	}
	if (filters.dateFrom) {
		conditions.push(gte(adminAuditLog.occurredAt, new Date(filters.dateFrom)));
	}
	if (filters.dateTo) {
		conditions.push(lte(adminAuditLog.occurredAt, new Date(filters.dateTo)));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function queryAuditLog(filters: AuditLogFilters = {}) {
	const pageSize = filters.pageSize ?? ADMIN_AUDIT_PAGE_SIZE;
	const page = Math.max(1, filters.page ?? 1);
	const offset = (page - 1) * pageSize;
	const where = buildWhereClause(filters);

	const [entries, totalResult] = await Promise.all([
		db.select().from(adminAuditLog).where(where).orderBy(desc(adminAuditLog.occurredAt)).limit(pageSize).offset(offset),
		db.select({ total: count() }).from(adminAuditLog).where(where),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		entries: entries.map((e) => ({
			...e,
			occurredAt: e.occurredAt.toISOString(),
		})),
		total,
		page,
		totalPages: Math.max(1, Math.ceil(total / pageSize)),
	};
}

export async function getDistinctActions(): Promise<string[]> {
	const result = await db
		.selectDistinct({ action: adminAuditLog.action })
		.from(adminAuditLog)
		.orderBy(adminAuditLog.action);
	return result.map((r) => r.action);
}

const CSV_HEADERS = ['Timestamp', 'Action', 'Actor Email', 'Target Type', 'Target ID', 'Detail', 'IP Address'];
const CSV_EXPORT_BATCH_SIZE = 1000;

function escapeCsv(val: string): string {
	// Formula injection: a leading =, +, - or @ executes when the CSV is opened in a
	// spreadsheet. Detail fields can carry user-controlled strings (e.g. passkey
	// names), so neutralize with a leading quote.
	const neutralized = /^[=+\-@]/.test(val) ? `'${val}` : val;
	if (neutralized.includes(',') || neutralized.includes('"') || neutralized.includes('\n')) {
		return `"${neutralized.replace(/"/g, '""')}"`;
	}
	return neutralized;
}

function toCsvRow(e: typeof adminAuditLog.$inferSelect): string {
	return [
		e.occurredAt.toISOString(),
		e.action,
		e.actorEmail,
		e.targetType ?? '',
		e.targetId ?? '',
		e.detail ? JSON.stringify(e.detail) : '',
		e.ipAddress ?? '',
	]
		.map(escapeCsv)
		.join(',');
}

/**
 * Stream the (filtered) audit log as CSV in keyset-paged batches. The log is an
 * unbounded growth table, so materializing it whole risks Vercel's 4.5MB response
 * cap and unbounded memory; this keeps resident memory to one batch. Yields the
 * header row first, then one \n-terminated string per batch.
 */
export async function* streamAuditLogCsv(filters: AuditLogFilters = {}): AsyncGenerator<string> {
	const where = buildWhereClause(filters);
	yield `${CSV_HEADERS.join(',')}\n`;

	let cursor: { occurredAt: Date; id: number } | null = null;
	for (;;) {
		const keyset: ReturnType<typeof and> = cursor
			? and(
					where,
					or(
						lt(adminAuditLog.occurredAt, cursor.occurredAt),
						and(eq(adminAuditLog.occurredAt, cursor.occurredAt), lt(adminAuditLog.id, cursor.id)),
					),
				)
			: where;
		const batch: (typeof adminAuditLog.$inferSelect)[] = await db
			.select()
			.from(adminAuditLog)
			.where(keyset)
			.orderBy(desc(adminAuditLog.occurredAt), desc(adminAuditLog.id))
			.limit(CSV_EXPORT_BATCH_SIZE);
		if (batch.length === 0) break;
		yield `${batch.map(toCsvRow).join('\n')}\n`;
		if (batch.length < CSV_EXPORT_BATCH_SIZE) break;
		const last = batch[batch.length - 1];
		if (!last) break;
		cursor = { occurredAt: last.occurredAt, id: last.id };
	}
}

/** Buffer the full CSV export into a string (small exports / tests). */
export async function exportAuditLogCsv(filters: AuditLogFilters = {}): Promise<string> {
	let out = '';
	for await (const chunk of streamAuditLogCsv(filters)) out += chunk;
	return out.replace(/\n$/, '');
}
