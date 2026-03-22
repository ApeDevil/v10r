import { and, count, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adminAuditLog } from '$lib/server/db/schema/admin';
import { ADMIN_AUDIT_PAGE_SIZE } from '$lib/server/config';

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
		db
			.select()
			.from(adminAuditLog)
			.where(where)
			.orderBy(desc(adminAuditLog.occurredAt))
			.limit(pageSize)
			.offset(offset),
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

export async function exportAuditLogCsv(filters: AuditLogFilters = {}): Promise<string> {
	const where = buildWhereClause(filters);

	const entries = await db
		.select()
		.from(adminAuditLog)
		.where(where)
		.orderBy(desc(adminAuditLog.occurredAt));

	const headers = ['Timestamp', 'Action', 'Actor Email', 'Target Type', 'Target ID', 'Detail', 'IP Address'];
	const rows = entries.map((e) => [
		e.occurredAt.toISOString(),
		e.action,
		e.actorEmail,
		e.targetType ?? '',
		e.targetId ?? '',
		e.detail ? JSON.stringify(e.detail) : '',
		e.ipAddress ?? '',
	]);

	const escapeCsv = (val: string) => {
		if (val.includes(',') || val.includes('"') || val.includes('\n')) {
			return `"${val.replace(/"/g, '""')}"`;
		}
		return val;
	};

	return [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
}
