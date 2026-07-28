/**
 * The composition root for MCP telemetry: turns one observed exchange into one `mcp.call_log` row.
 *
 * This is the only place that knows about surfaces, caller keys, traffic classification, and the
 * database. `respondToMcpPost` receives an `McpCallObserver` and never learns any of it — which is
 * why the seam survived the question of whether a caller key would exist at all.
 *
 * ## Ordering guarantees
 *
 *  - `observe()` returns `void`. There is nothing for the caller to await, so telemetry cannot add
 *    latency to, or fail, an MCP response.
 *  - The row is BUILT INSIDE the deferred closure. Building it on the hot path is the one real
 *    hazard here: a synchronous throw while serialising an argument would surface as a 500 on a
 *    tool call that actually succeeded.
 *  - `.catch()` is attached BEFORE the promise is handed to `waitUntil`. Attached after, a rejection
 *    becomes an unhandled rejection on an instance that may already be frozen.
 *  - ONE row per POST, written once at the terminating edge — never a "begin" row plus an "end"
 *    UPDATE, where losing the second write leaves rows that look like hangs but were successes.
 *
 * ## A property worth not "fixing"
 *
 * Because the write is deferred until after the response, a usage-reporting tool cannot observe its
 * own current call — only prior ones. That is correct append-only semantics and it removes the
 * read-your-own-writes loop for free. Do not make this await.
 */
import { waitUntil } from '@vercel/functions';
import { env } from '$env/dynamic/private';
import type { McpCallObservation, McpCallObserver } from '../types';
import { deriveClientKey } from './client-key';
import { inferOutcome, type McpGateReason, normalizeMethod } from './outcome';
import { normalizeQueryText } from './scrub';
import { classifyClientFamily, classifyTraffic } from './self-traffic';
import { resolveTraceId } from './traceparent';
import { type McpCallLogRow, writeCallLog } from './writer';

/** Mirrors the database CHECK. The DB is the floor; this is the polite path. */
const MAX_QUERY_TEXT = 200;

/** Ceiling on rows per UTC day, ~1000x the expected steady state. See writer.ts for why. */
const DAILY_WRITE_BUDGET = 50_000;

/** Bounded so a hostile value cannot widen a column. Mirrors the DB CHECKs. */
function cap(value: string | null, max: number): string | null {
	if (value === null) return null;
	return value.length > max ? value.slice(0, max) : value;
}

export interface McpObserverContext {
	surface: 'public' | 'admin';
	/** Client address from the platform, never a client-supplied header. */
	ip: string | null;
	headers: Headers;
	/** Time spent in rate limiting + auth. `> 1000` means the limiter FAIL-OPENED. */
	gateMs: number;
	/** Version of the pattern registry that answered — the feedback-loop dimension. */
	registryVersion: string;
	/** Registry membership test, for distinguishing the transport's two bare error results. */
	knownTool: (name: string) => boolean;
	/** The parsed JSON-RPC body, for reading `_meta.traceparent`. */
	body: unknown;
}

/**
 * Build the row. Pure apart from reading the clock — so it is unit-testable without a database,
 * and so everything expensive or throw-prone happens off the request path.
 */
export function buildCallLogRow(
	observation: McpCallObservation,
	context: McpObserverContext,
	now: Date,
): McpCallLogRow {
	const { stage, outcome } = inferOutcome(observation, context.knownTool);
	const userAgent = context.headers.get('user-agent');
	const traffic = classifyTraffic({
		headers: context.headers,
		vercelEnv: env.VERCEL_ENV,
		selfSecret: env.MCP_SELF_TRAFFIC_TOKEN,
	});

	// The database CHECK allows query text only on the no-match path; honour that here rather than
	// discovering it as a constraint violation. This narrowness IS the data-minimisation argument.
	const queryText =
		outcome === 'empty' && context.surface === 'public'
			? normalizeQueryText(extractQuery(observation.args), MAX_QUERY_TEXT)
			: null;

	// No caller identifier on rejection rows: a per-reason counter answers everything a rejection
	// needs, and those rows sit on the path an attacker controls the volume of.
	const clientKey =
		stage === 'protocol' || stage === 'tool'
			? deriveClientKey(context.ip, userAgent, env.MCP_TELEMETRY_SALT, now)
			: null;

	return {
		surface: context.surface,
		traffic,
		stage,
		outcome,
		method: normalizeMethod(observation.method) as McpCallLogRow['method'],
		toolName: observation.method === 'tools/call' ? (cap(observation.toolName, 64) ?? '(unknown)') : null,
		subject: null,
		queryText,
		requestedProtocolVersion: cap(observation.requestedProtocolVersion, 32),
		servedProtocolVersion: cap(observation.servedProtocolVersion, 32),
		// Mere presence of the RC-era headers is a free era detector, and costs current-era clients
		// exactly nothing: a `headers.get()` that returns null.
		rcHeaders: context.headers.get('mcp-method') !== null,
		clientFamily: classifyClientFamily(userAgent),
		clientName: cap(observation.clientName, 64),
		clientVersion: cap(observation.clientVersion, 32),
		traceId: resolveTraceId(context.body, context.headers),
		clientKey,
		registryVersion: cap(context.registryVersion, 32) ?? 'unknown',
		totalMs: Math.max(0, context.gateMs + observation.handleMs),
		gateMs: Math.max(0, context.gateMs),
		dispatchMs: stage === 'tool' ? Math.max(0, observation.handleMs) : null,
		startedAt: now,
	};
}

/** Pull the caller's free-text query out of tool arguments, whichever tool it came from. */
function extractQuery(args: unknown): unknown {
	if (typeof args !== 'object' || args === null) return null;
	const record = args as Record<string, unknown>;
	if (typeof record.query === 'string') return record.query;
	if (typeof record.capability === 'string') return record.capability;
	if (Array.isArray(record.capabilities)) return record.capabilities.filter((c) => typeof c === 'string').join(', ');
	return null;
}

/**
 * Build the observer for one request.
 *
 * MUST be called inside the request handler, never at module scope: it closes over `gateMs` and the
 * caller's headers, so a module-scoped instance would be cross-request state contamination on a
 * warm serverless instance.
 */
export function createMcpObserver(context: McpObserverContext): McpCallObserver {
	return {
		observe(observation) {
			waitUntil(
				(async () => {
					// Everything from here runs AFTER the response. A throw while building the row would
					// otherwise 500 a tool call that already succeeded.
					const row = buildCallLogRow(observation, context, new Date());
					if (await overBudget()) return;
					await writeCallLog(row);
				})().catch((cause: unknown) => {
					console.error('[mcp-telemetry] observer failed:', cause instanceof Error ? cause.message : 'unknown');
				}),
			);
		},
	};
}

/**
 * Record a request refused BEFORE the transport ran.
 *
 * Deliberately a separate function rather than a method on `McpCallObserver`: gate rejections have
 * no method, no tool and no dispatch, and `respondToMcpPost` never sees them. Widening the port to
 * carry a shape its only consumer cannot produce would make the interface lie about what the HTTP
 * layer observes.
 *
 * Note the caller is expected NOT to use this for rate limiting — a refused request must stay cheap,
 * and counting refusals is a counter's job. This exists for auth outcomes, which are low-volume by
 * construction and are a security signal worth a row.
 */
export function recordMcpGateRejection(context: McpObserverContext, reason: McpGateReason): void {
	waitUntil(
		(async () => {
			const now = new Date();
			const row: McpCallLogRow = {
				surface: context.surface,
				traffic: classifyTraffic({
					headers: context.headers,
					vercelEnv: env.VERCEL_ENV,
					selfSecret: env.MCP_SELF_TRAFFIC_TOKEN,
				}),
				stage: 'gate',
				outcome: reason,
				method: null,
				toolName: null,
				subject: null,
				queryText: null,
				requestedProtocolVersion: cap(context.headers.get('mcp-protocol-version'), 32),
				servedProtocolVersion: null,
				rcHeaders: context.headers.get('mcp-method') !== null,
				clientFamily: classifyClientFamily(context.headers.get('user-agent')),
				clientName: null,
				clientVersion: null,
				traceId: resolveTraceId(context.body, context.headers),
				// No caller identifier on a rejection row — see the schema's key-scope CHECK.
				clientKey: null,
				registryVersion: cap(context.registryVersion, 32) ?? 'unknown',
				totalMs: Math.max(0, context.gateMs),
				gateMs: Math.max(0, context.gateMs),
				dispatchMs: null,
				startedAt: now,
			};
			if (await overBudget()) return;
			await writeCallLog(row);
		})().catch((cause: unknown) => {
			console.error('[mcp-telemetry] gate record failed:', cause instanceof Error ? cause.message : 'unknown');
		}),
	);
}

/** Cheap guard so a flood cannot turn the log into a storage-exhaustion vector. */
async function overBudget(): Promise<boolean> {
	const { countRowsToday } = await import('./writer');
	try {
		const today = await countRowsToday();
		if (today >= DAILY_WRITE_BUDGET) {
			console.error(`[mcp-telemetry] daily write budget (${DAILY_WRITE_BUDGET}) reached; dropping rows`);
			return true;
		}
		return false;
	} catch {
		// If the budget cannot be read, prefer recording over silently going blind.
		return false;
	}
}
