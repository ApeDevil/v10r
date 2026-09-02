/**
 * MCP demo-state domain module — the framework-free boundary shared by the private admin
 * MCP tools and the protected `/admin/mcp` page. All business rules (validation, version
 * increment, attribution, audit) live here, never in a route handler.
 *
 * Concurrency: mutations use optimistic compare-and-swap with bounded retry. Each attempt
 * reads the current row, then issues `UPDATE … SET version = read.version + 1 …
 * WHERE id = singleton AND version = read.version RETURNING …`. If another writer committed
 * between the read and the update, the guarded UPDATE matches zero rows and the attempt
 * retries with a fresh read. On success the row we read is, by construction, the IMMEDIATE
 * predecessor of the returned row — so every response's `before` is exactly the state that
 * `after` replaced. This is a single guarded statement per attempt (no WebSocket transaction),
 * so it works under the project's fetch-routed Neon driver.
 *
 * Audit is BEST-EFFORT: after a successful swap we record an admin audit-log row, but a
 * failure there is logged and never rolls back the accepted state change. Callers must not
 * treat audit persistence as guaranteed.
 */
import { and, eq } from 'drizzle-orm';
import { queryAuditLog, recordAuditEvent } from '$lib/server/admin/audit';
import { db } from '$lib/server/db';
import { type McpDemoStateRow, mcpDemoState } from '$lib/server/db/schema/mcp';
import { INITIAL_DEMO_STATE, MCP_DEMO_STATE_ID } from './config';
import { parseColor, parseMessage } from './validation';

/** Serializable view of the demo state — timestamps are ISO strings, safe to send anywhere. */
export interface DemoStateView {
	message: string;
	color: string;
	version: number;
	updatedAt: string;
	updatedBy: string | null;
}

/** Who is performing the mutation. For the admin MCP this is a machine identity. */
export interface DemoActor {
	id: string;
	email: string;
	/** Human-friendly channel label recorded in the audit detail, e.g. "admin-mcp". */
	label?: string;
	ip?: string;
}

export type ChangedField = 'message' | 'color' | 'reset';

export type SetStateResult =
	| { ok: true; field: ChangedField; before: DemoStateView; after: DemoStateView }
	| { ok: false; code: 'invalid_message' | 'invalid_color' | 'conflict'; message: string };

export type ResetResult =
	| { ok: true; before: DemoStateView; after: DemoStateView }
	| { ok: false; code: 'conflict'; message: string };

interface HistorySnapshot {
	message: string | null;
	color: string | null;
	version: number | null;
}

export interface HistoryEntry {
	field: string;
	actor: string;
	occurredAt: string;
	before: HistorySnapshot;
	after: HistorySnapshot;
}

/** How many CAS attempts before giving up. A singleton almost never collides; this is a safety net. */
const MAX_CAS_ATTEMPTS = 8;
const CONFLICT_MESSAGE = 'The demo state changed concurrently; please retry.';

function toView(row: McpDemoStateRow): DemoStateView {
	return {
		message: row.message,
		color: row.color,
		version: row.version,
		updatedAt: row.updatedAt.toISOString(),
		updatedBy: row.updatedBy,
	};
}

/** Create the singleton with seed values if it is missing. Idempotent and race-safe. */
async function ensureInitialized(): Promise<void> {
	await db
		.insert(mcpDemoState)
		.values({
			id: MCP_DEMO_STATE_ID,
			message: INITIAL_DEMO_STATE.message,
			color: INITIAL_DEMO_STATE.color,
		})
		.onConflictDoNothing();
}

/** Read the current demo state, provisioning defaults on first access. */
export async function getDemoState(): Promise<DemoStateView> {
	await ensureInitialized();
	const [row] = await db.select().from(mcpDemoState).where(eq(mcpDemoState.id, MCP_DEMO_STATE_ID)).limit(1);
	if (!row) {
		// Should be unreachable after ensureInitialized, but never hand back a partial state.
		throw new Error('MCP demo state row missing after initialization');
	}
	return toView(row);
}

async function recordDemoAudit(
	field: ChangedField,
	before: DemoStateView,
	after: DemoStateView,
	actor: DemoActor,
): Promise<void> {
	try {
		await recordAuditEvent({
			actorId: actor.id,
			actorEmail: actor.email,
			action: field === 'reset' ? 'mcp.reset_state' : `mcp.set_${field}`,
			targetType: 'mcp_demo_state',
			targetId: MCP_DEMO_STATE_ID,
			detail: {
				via: actor.label ?? 'admin-mcp',
				before: { message: before.message, color: before.color, version: before.version },
				after: { message: after.message, color: after.color, version: after.version },
			},
			ipAddress: actor.ip,
		});
	} catch (cause) {
		// Attribution is best-effort — an audit failure must not undo an accepted change.
		console.error('[mcp-demo] audit write failed (state change already applied):', cause);
	}
}

type ApplyResult = { ok: true; before: DemoStateView; after: DemoStateView } | { ok: false; code: 'conflict' };

/**
 * Optimistic compare-and-swap with bounded retry. Returns before/after where `before` is the
 * verified immediate predecessor of `after`, or a conflict after the retry budget is spent.
 */
async function applyChange(
	patch: Partial<Pick<McpDemoStateRow, 'message' | 'color'>>,
	field: ChangedField,
	actor: DemoActor,
): Promise<ApplyResult> {
	await ensureInitialized();
	for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
		const [current] = await db.select().from(mcpDemoState).where(eq(mcpDemoState.id, MCP_DEMO_STATE_ID)).limit(1);
		if (!current) {
			// Lost the row (e.g. a concurrent reset of the table) — re-provision and retry.
			await ensureInitialized();
			continue;
		}
		const [swapped] = await db
			.update(mcpDemoState)
			.set({
				...patch,
				version: current.version + 1,
				updatedAt: new Date(),
				updatedBy: actor.id,
			})
			// The version guard is the CAS: it matches only if nobody wrote since our read.
			.where(and(eq(mcpDemoState.id, MCP_DEMO_STATE_ID), eq(mcpDemoState.version, current.version)))
			.returning();
		if (!swapped) {
			// A concurrent writer bumped the version between our read and this update — retry.
			continue;
		}
		const before = toView(current);
		const after = toView(swapped);
		await recordDemoAudit(field, before, after, actor);
		return { ok: true, before, after };
	}
	return { ok: false, code: 'conflict' };
}

export async function setDemoMessage(rawMessage: unknown, actor: DemoActor): Promise<SetStateResult> {
	const parsed = parseMessage(rawMessage);
	if (!parsed.ok) return { ok: false, code: 'invalid_message', message: parsed.message };
	const result = await applyChange({ message: parsed.value }, 'message', actor);
	if (!result.ok) return { ok: false, code: 'conflict', message: CONFLICT_MESSAGE };
	return { ok: true, field: 'message', before: result.before, after: result.after };
}

export async function setDemoColor(rawColor: unknown, actor: DemoActor): Promise<SetStateResult> {
	const parsed = parseColor(rawColor);
	if (!parsed.ok) return { ok: false, code: 'invalid_color', message: parsed.message };
	const result = await applyChange({ color: parsed.value }, 'color', actor);
	if (!result.ok) return { ok: false, code: 'conflict', message: CONFLICT_MESSAGE };
	return { ok: true, field: 'color', before: result.before, after: result.after };
}

/** Reset both values to their seed state (still increments version + records audit). */
export async function resetDemoState(actor: DemoActor): Promise<ResetResult> {
	const result = await applyChange(
		{ message: INITIAL_DEMO_STATE.message, color: INITIAL_DEMO_STATE.color },
		'reset',
		actor,
	);
	if (!result.ok) return { ok: false, code: 'conflict', message: CONFLICT_MESSAGE };
	return { ok: true, before: result.before, after: result.after };
}

/** Recent mutation history, read back from the shared admin audit log, with before + after. */
export async function getDemoHistory(limit = 10): Promise<HistoryEntry[]> {
	const { entries } = await queryAuditLog({ targetType: 'mcp_demo_state', pageSize: Math.min(Math.max(1, limit), 50) });
	const snapshot = (raw: unknown): HistorySnapshot => {
		const s = (raw ?? {}) as { message?: unknown; color?: unknown; version?: unknown };
		return {
			message: typeof s.message === 'string' ? s.message : null,
			color: typeof s.color === 'string' ? s.color : null,
			version: typeof s.version === 'number' ? s.version : null,
		};
	};
	return entries.map((entry) => {
		const detail = (entry.detail ?? {}) as { before?: unknown; after?: unknown };
		return {
			field: entry.action.replace(/^mcp\./, ''),
			actor: entry.actorEmail,
			occurredAt: entry.occurredAt,
			before: snapshot(detail.before),
			after: snapshot(detail.after),
		};
	});
}
