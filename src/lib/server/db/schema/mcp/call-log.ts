/**
 * MCP CALL LOG — Immutable, append-only record of every request reaching an `/api/mcp/*` route.
 *
 * One POST produces exactly ONE row, written at a single terminating edge after the outcome is
 * decided. There is never a "begin" row plus an "end" UPDATE: the second write can be lost,
 * leaving permanently-pending rows that look like hangs when they were successes.
 *
 * ## One table, not two
 *
 * Requests that die at the gate (rate limit / auth) or at the envelope (origin / protocol version
 * / parse) share this table with requests that reached a tool. The highest-value question — "what
 * fraction of arrivals never reached a tool" — is a funnel over one ordered stream, and splitting
 * it makes the arrivals denominator a two-sourced number that composes wrongly with sampling.
 * Column-set divergence is handled by the stage/outcome CHECK below and by partial indexes.
 *
 * Rejected rows are not all-NULL the way a naive split assumes: `Mcp-Method` / `Mcp-Name`,
 * `traceparent` and `User-Agent` all arrive in HEADERS, before any gate or parse, so a gate row
 * can still name the tool the caller was reaching for.
 *
 * ## No identifier beyond a keyed, day-scoped hash
 *
 * There is deliberately NO raw IP, no session id, and no FK to `user`. `clientKey` is
 * HMAC-SHA256(MCP_TELEMETRY_SALT, ip:ua:UTC-date) — keyed, because a bare SHA-256 over the IPv4
 * space plus a handful of real UA strings is ~2^35 hashes and inverts on a laptop; that is
 * obfuscation, not pseudonymisation. It is NULL on gate/envelope rows (a per-reason counter
 * answers everything a rejection needs, and rejections sit on the path an attacker controls the
 * volume of), and it is NULLABLE everywhere so a missing salt degrades the column rather than
 * failing the write.
 *
 * `clientKey` is forgeable UPWARD — a caller varying its User-Agent mints unlimited distinct keys.
 * Never label `count(DISTINCT client_key)` as "number of consumers", and never treat this table as
 * security telemetry.
 *
 * This table shares NO join key with either `analytics` lane or with `admin.audit_log`. That is
 * what keeps DPIA screening criterion 6 ("matching or combining datasets") answerable as "No" —
 * hence no FKs here, deliberately.
 *
 * ## OTel naming (names aligned where free; NO exporter is shipped)
 *
 *   mcp.method.name             → method
 *   gen_ai.tool.name            → toolName
 *   error.type                  → outcome (superset; maps on the failure values)
 *   mcp.protocol.version        → servedProtocolVersion
 *   user_agent.name/.version    → clientFamily / clientVersion
 *   gen_ai.tool.call.arguments  → queryText   (OTel classifies this Opt-In, its most restrictive
 *                                 level — independent corroboration of the narrow scope below)
 *   mcp.server.operation.duration → totalMs
 *      ⚠ OTel's metric is in SECONDS. These columns are integer MILLISECONDS. An exporter must
 *        divide by 1000 or it reports 300x too slow.
 *   client.address / mcp.session.id → DELIBERATELY ABSENT. OTel marks client.address
 *        *Recommended*, but semantic conventions are interoperability guidance with no legal
 *        weight. Do not "complete" the mapping by adding the IP back.
 *
 * ## Known blind spot — timeouts are structurally unrecordable
 *
 * The row is written via `waitUntil`, and Vercel cancels those promises when the function times
 * out. Cancellation is therefore perfectly correlated with request timeout: the rows lost are
 * exactly the rows describing the requests that timed out. There is no `outcome='timeout'` and
 * there cannot be one from inside this design. Do NOT read a clean latency histogram here as
 * proof that no requests time out — that answer lives in the platform logs.
 *
 * ## Retention (jobs/mcp-telemetry-retention.ts, weekly)
 *
 *   1. 30d — UPDATE ... SET query_text = NULL, trace_id = NULL   (minimise by COLUMN)
 *   2. 90d — DELETE rows                                          (then by ROW)
 *
 * Both are absolute-age predicates, so they are idempotent and self-healing: Vercel's +-59min
 * cron jitter is irrelevant and a missed week is fully repaired by the next run. Do NOT
 * "optimise" either into a since-last-run window — that destroys the property. On a weekly
 * cadence the EFFECTIVE windows are 30-37d and 90-97d; document the upper bound, not the nominal.
 *
 * Every CHECK here lives in the drizzle definition on purpose: this is a `db:push`-only repo, so a
 * constraint added by hand to Neon is invisible to drizzle and gets dropped by the next push.
 *
 * MUST be re-exported from `schema/mcp/index.ts` — `db:push` silently drops enums and tables it
 * cannot reach from the schema index.
 */

import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { mcpSchema } from './demo-state';

// ── Enums (MUST be exported or db:push silently omits them) ─────────────────

/**
 * Which hosted endpoint served the request. The local stdio server runs `--network=none` on the
 * consumer's machine and structurally cannot report, so it is not a value here.
 */
export const mcpSurfaceEnum = mcpSchema.enum('mcp_surface', ['public', 'admin']);

/**
 * Whether this row counts as real external traffic.
 *
 * `self`    — the operator's own curl/CI, identified by a secret header compared in constant time.
 *             Attribution ONLY; it never feeds an authz decision.
 * `preview` — VERCEL_ENV !== 'production'. Preview deployments share the production Neon database,
 *             so without this every preview call contaminates the KPI strip. This is a larger
 *             contamination source than curl and it is easy to forget.
 * `test`    — synthetic monitors and E2E runs against a deployed environment.
 *
 * Every KPI query filters `traffic = 'external'` — one filter, and it cannot forget to also
 * exclude admin (see the admin CHECK below). NOT NULL from the first row: retrofitting it would
 * mean a nullable-then-backfill dance that push-only makes awkward.
 */
export const mcpTrafficEnum = mcpSchema.enum('mcp_traffic', ['external', 'self', 'preview', 'test']);

/**
 * How far the request got. THE FUNNEL ORDINATE — declaration order IS funnel order, so Postgres
 * enum comparison makes `WHERE stage >= 'tool'` work natively, with one GROUP BY and no UNION.
 * Monotone: any request reaching stage N passed every stage before it.
 *
 * This is also what counts `tools/list` separately from tool calls: a client-side tools/list loop
 * inflates only `protocol` and CANNOT touch the tool-call denominator.
 */
export const mcpCallStageEnum = mcpSchema.enum('mcp_call_stage', [
	'gate', //     died at rate limit / bearer auth / unconfigured — never reached the transport
	'envelope', // died at origin / protocol-version / JSON parse / JSON-RPC envelope validation
	'protocol', // a valid JSON-RPC method that is not tools/call: initialize, ping, tools/list, ...
	'tool', //     reached tool dispatch, or was refused by the registry allowlist
]);

/**
 * The disposition at the stage where the request stopped. Which values are legal at which stage is
 * enforced by `mcp_call_stage_outcome` below, so `stage='tool'` with `outcome='rate_limited'` is
 * unrepresentable.
 *
 * `empty` is the money value: the tool ran, matched nothing, and noMatchHelp() fired — a consumer
 * named a capability the registry does not have.
 *
 * `not_found` is deliberately distinct from `invalid_args`: "you asked for a real-shaped thing we
 * do not have" is a REGISTRY GAP; "your arguments were malformed" is a CLIENT BUG. Collapsing them
 * loses the improvement signal that justifies this table.
 *
 * `snapshot_miss` is an OPERATOR ALARM, not a caller error: the path is allowlisted but absent
 * from the build-time excerpt snapshot, meaning `mcp:excerpts:build` drifted in production.
 *
 * `tool_error` is a COVERAGE METER, not an outcome anyone should see: it means a handler returned
 * `isError` without a `diag`. Non-zero ⇒ an uninstrumented `errorResult` call site exists.
 */
export const mcpCallOutcomeEnum = mcpSchema.enum('mcp_call_outcome', [
	// stage: tool
	'ok',
	'empty',
	'invalid_args',
	'not_found',
	'snapshot_miss',
	'conflict', //     optimistic-concurrency loss on the admin demo CAS — NOT a client bug
	'unknown_tool',
	'threw',
	'tool_error', //   isError with no diag — see above
	// stage: protocol
	'unknown_method', // resources/list, prompts/list, ... — client interop probes worth reading
	// stage: envelope
	'bad_envelope', //   batch, non-object, bad jsonrpc, bad id, missing method
	'parse_error',
	'unsupported_version',
	'forbidden_origin',
	// stage: gate
	'rate_limited',
	'unauthorized',
	'unconfigured',
	// any stage
	'internal_error',
]);

/**
 * JSON-RPC method, bucketed. Unknown method names are caller-controlled text and normalise to
 * 'other'. `server/discover` and `subscriptions/listen` are pre-seeded from the 2026-07-28 spec
 * revision: enum values are free now, and an ALTER TYPE on a push-only repo is not.
 */
export const mcpMethodEnum = mcpSchema.enum('mcp_method', [
	'initialize',
	'ping',
	'tools/list',
	'tools/call',
	'notification',
	'server/discover',
	'subscriptions/listen',
	'other',
]);

// ── Table ───────────────────────────────────────────────────────────────────

export const mcpCallLog = mcpSchema.table(
	'call_log',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

		surface: mcpSurfaceEnum('surface').notNull(),
		traffic: mcpTrafficEnum('traffic').notNull(),
		stage: mcpCallStageEnum('stage').notNull(),
		outcome: mcpCallOutcomeEnum('outcome').notNull(),

		/**
		 * Null only for a gate rejection from a pre-RC client (no body parsed, no `Mcp-Method`
		 * header). RC-era clients populate it before any parse.
		 */
		method: mcpMethodEnum('method'),

		/**
		 * Resolved against `registry.tools` ALWAYS, from whatever source (body params or the RC
		 * `Mcp-Name` header), so the domain is bounded by construction; unrecognised names become
		 * '(unknown)'. The length CHECK is a database-side backstop, not the primary control.
		 *
		 * Never taken from `Mcp-Name` alone: the RC makes header/body agreement a server MUST, but
		 * this server does not enforce it, so the header is untrusted input. The body value is
		 * authoritative and is in scope at the same seam.
		 */
		toolName: text('tool_name'),

		/**
		 * The bounded grouping key — what the registry ANSWERED WITH, never caller text.
		 *   get_pattern      → resolved pattern id      | '(invalid)'
		 *   get_file_excerpt → allowlisted path         | '(not-allowlisted)'
		 *   search family    → top matched pattern id   | '(no-match)'
		 * Answers "which patterns are fetched but never traced" and "which excerpt paths are
		 * requested", with a domain bounded by the registry rather than by the caller.
		 *
		 * No FK: the pattern registry is a build-time JSON artifact, not a table.
		 */
		subject: text('subject'),

		/**
		 * The raw caller query string — the ONLY unbounded-cardinality value in this table, and it
		 * is written ONLY on the no-match path (enforced by `mcp_call_query_scope`). A query that
		 * MATCHED tells you nothing the outcome does not; a query that matched NOTHING is the
		 * product signal. That narrowness is the whole necessity argument, and it also collapses
		 * retained text to the miss rate.
		 *
		 * The 200-char CHECK is a LOAD-BEARING PRIVACY CONTROL, not hygiene: a recorder bug cannot
		 * dump a consumer's multi-KB proprietary payload into an internet-facing table. Enforced by
		 * the DATABASE, not by a caller's discipline. Nulled at 30 days.
		 *
		 * Displayed only above a >=3-distinct-client threshold — simultaneously k-anonymity over
		 * third-party text and the anti-poisoning control for the capability-gaps panel.
		 */
		queryText: text('query_text'),

		/**
		 * What the caller ASKED for vs what this server ANSWERED with. Two columns, not one,
		 * because recording only the negotiated version erases the migration signal at the moment
		 * of capture: a client that requests 2026-07-28, gets a 400, falls back, and negotiates
		 * 2025-11-25 would otherwise be indistinguishable from a plain 2025-11-25 client.
		 *
		 * Caller-controlled, so allowlisted to known version strings with '(other)' as the sink.
		 * ⚠ `servedProtocolVersion` currently over-reports 2025-06-18: `DEFAULT_PROTOCOL_VERSION`
		 * is `SUPPORTED_PROTOCOL_VERSIONS[1]`, while the spec says the fallback SHOULD be latest.
		 */
		requestedProtocolVersion: text('requested_protocol_version'),
		servedProtocolVersion: text('served_protocol_version'),

		/**
		 * The 2026-07-28 revision makes `Mcp-Method` / `Mcp-Name` REQUIRED headers. Their mere
		 * presence is a free era-detector — what fraction of callers have migrated — and costs
		 * current-era clients exactly nothing (a `headers.get()` that returns null).
		 */
		rcHeaders: boolean('rc_headers').notNull().default(false),

		/**
		 * Bucketed from User-Agent on EVERY row (claude-code | claude-web | cursor | vscode |
		 * inspector | sdk | curl | bot | other | none). Derived from ONE source so there is nothing
		 * to drift. Self-asserted and trivially spoofable — never an auth or authz input.
		 */
		clientFamily: text('client_family').notNull(),

		/**
		 * Self-reported `clientInfo`. Today populated on `initialize` rows only — there is no
		 * session key to carry them forward, by design. Under the 2026-07-28 revision
		 * `_meta['io.modelcontextprotocol/clientInfo']` arrives on every request and these two
		 * columns simply start being populated everywhere; nullable now for exactly that reason.
		 *
		 * The spec flags these as self-reported and unverified, and Claude Code currently sends the
		 * placeholder {"name":"claude-ai","version":"0.1.0"} — do not read meaning into a value.
		 */
		clientName: text('client_name'),
		clientVersion: text('client_version'),

		/**
		 * W3C Trace Context trace-id from `traceparent` (`_meta` under SEP-414, or the HTTP header
		 * as sent de-facto today). Communication content the caller minted for correlation, derived
		 * from nothing about the device.
		 *
		 * ⚠ AN INCIDENT-LOOKUP KEY, NEVER A FUNNEL KEY. It is per-agent-TURN, not per-consumer, and
		 * present for only a minority of callers. Grouping a funnel by it measures the
		 * subpopulation modern enough to emit trace context and renders a plausible-looking chart
		 * of the wrong population — the panel would read "nobody who initializes ever calls a
		 * tool", which is false and survives a glance. The index below deliberately omits
		 * `started_at` so it can serve a point lookup and cannot serve a time-bucketed GROUP BY.
		 *
		 * Nulled at 30 days: an incident unreported in 30 days will never be reported.
		 */
		traceId: text('trace_id'),

		/**
		 * HMAC-SHA256(MCP_TELEMETRY_SALT, ip:ua:UTC-date). Never a raw IP, never an unkeyed digest.
		 * NULL on gate/envelope rows and NULL when the salt is unset — fail open on the COLUMN,
		 * never on the row, so a missing secret degrades analytics instead of failing writes.
		 */
		clientKey: text('client_key'),

		/**
		 * REGISTRY.version at the time of the call. This is the column that turns a log into a
		 * feedback loop: "did the miss rate for 'background jobs' drop after registry v1.3?" is a
		 * GROUP BY away. Without it you can see failures but never whether a fix worked.
		 */
		registryVersion: text('registry_version').notNull(),

		/**
		 * How many real occurrences this row stands for. Normally 1.
		 *
		 * Because sampled rows carry their multiplier, arrivals are ALWAYS SUM(observed_count) and
		 * never count(*). There is exactly one correct way to count.
		 */
		observedCount: integer('observed_count').notNull().default(1),

		/** Wall clock the consumer feels: first line of the route handler → Response constructed. */
		totalMs: integer('total_ms').notNull(),

		/**
		 * Rate limiter + auth. THE UPSTASH REDIS ROUND-TRIP, on the path of every request. Kept
		 * separate because public tool execution is pure CPU over a static registry — sub-
		 * millisecond. Pool these and you will conclude "the MCP is slow" when the tools are free
		 * and the rate limiter is the entire cost.
		 *
		 * Doubles as a free security alarm: gate_ms > 1000 on the public surface means the limiter
		 * FAIL-OPENED and the rate limit was not enforced for that request.
		 */
		gateMs: integer('gate_ms').notNull(),

		/**
		 * Tool dispatch only. Null unless the request reached a tool. Public and admin are two
		 * different distributions (admin dispatch hits Neon with a CAS retry loop) — always read
		 * this per `surface`, never pooled.
		 */
		dispatchMs: integer('dispatch_ms'),

		/** Request START, so row order matches arrival order and the durations extend forward. */
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		// ── Indexes ────────────────────────────────────────────────────────────
		// Every partial predicate is `IS NOT NULL` and none compares an enum: an enum-comparing
		// index predicate normalises to `'x'::mcp.enum` and makes drizzle-kit push see a permanent
		// diff on every run.

		// The workhorse: stage funnel, outcome health, recent activity, retention scan.
		index('mcp_call_started_idx').on(table.startedAt.desc()),

		// Per-tool volume and latency percentiles. PARTIAL, so gate/envelope/protocol rows
		// structurally cannot enter the index the tool dashboards ride.
		index('mcp_call_tool_idx').on(table.toolName, table.startedAt.desc()).where(sql`${table.toolName} IS NOT NULL`),

		// THE MONEY QUERY: "which queries returned nothing, most frequent first". Because
		// query_text is written only on the no-match path, this predicate is exactly the miss set —
		// a few rows a day, not the whole table. Without this index the one query whose input is
		// unbounded text degrades to a seq scan, and it degrades worst of all of them.
		index('mcp_call_miss_idx').on(table.startedAt.desc()).where(sql`${table.queryText} IS NOT NULL`),

		// "Which patterns are fetched but never traced / which excerpt paths are requested."
		index('mcp_call_subject_idx').on(table.subject, table.startedAt.desc()).where(sql`${table.subject} IS NOT NULL`),

		// Incident lookup by trace id. DELIBERATELY omits started_at: this index must serve a point
		// lookup and must NOT make a time-bucketed GROUP BY attractive. Refusing to build the index
		// that makes the wrong query fast is how "make wrong states unrepresentable" applies to a
		// query plan.
		index('mcp_call_trace_idx').on(table.traceId).where(sql`${table.traceId} IS NOT NULL`),

		// NOT indexed: `traffic`. 'external' is >90% of rows, so a partial index on it would be
		// nearly the whole table; it is a filter applied after the time range narrows the scan.

		// ── Constraints ────────────────────────────────────────────────────────

		// THE tagged union. Makes every impossible stage/outcome pair unrepresentable.
		check(
			'mcp_call_stage_outcome',
			sql`CASE ${table.stage}
				WHEN 'gate'     THEN ${table.outcome} IN ('rate_limited','unauthorized','unconfigured','internal_error')
				WHEN 'envelope' THEN ${table.outcome} IN ('forbidden_origin','unsupported_version','parse_error','bad_envelope','internal_error')
				WHEN 'protocol' THEN ${table.outcome} IN ('ok','unknown_method','internal_error')
				WHEN 'tool'     THEN ${table.outcome} IN ('ok','empty','invalid_args','not_found','snapshot_miss','conflict','unknown_tool','threw','tool_error','internal_error')
			END`,
		),

		// tool_name is set if and only if this was a tools/call — including a gate rejection whose
		// RC headers named the tool before any parse. IS DISTINCT FROM keeps it NULL-safe both ways.
		check(
			'mcp_call_tool_scope',
			sql`(${table.toolName} IS NULL AND ${table.method} IS DISTINCT FROM 'tools/call')
			 OR (${table.toolName} IS NOT NULL AND ${table.method} = 'tools/call')`,
		),

		// Raw caller text exists ONLY on the no-match path. This puts the data-minimisation
		// necessity argument in the database instead of in a recorder's discipline.
		check('mcp_call_query_scope', sql`${table.queryText} IS NULL OR ${table.outcome} = 'empty'`),

		// LOAD-BEARING PRIVACY CONTROL — truncation enforced by the database.
		check('mcp_call_query_len', sql`${table.queryText} IS NULL OR char_length(${table.queryText}) <= 200`),

		// The admin surface's only free text is the demo message, already recorded in
		// admin.audit_log with before/after detail. Storing it twice is pure risk and no signal.
		check('mcp_call_admin_no_text', sql`${table.surface} <> 'admin' OR ${table.queryText} IS NULL`),

		// The admin surface has exactly one authorised caller and it is the operator, so admin rows
		// can never inflate an external-traffic KPI. Permits 'self' and 'preview'; forbids only the
		// value that would lie.
		check('mcp_call_admin_not_external', sql`${table.surface} <> 'admin' OR ${table.traffic} <> 'external'`),

		// No caller identifier on rejection rows: a per-reason counter answers everything a
		// rejection needs, and these rows sit on the path an attacker controls the volume of.
		check('mcp_call_key_scope', sql`${table.clientKey} IS NULL OR ${table.stage} IN ('protocol','tool')`),

		// traceparent is caller-controlled text. Without this the column is a second unbounded
		// free-text sink on an unauthenticated endpoint — exactly what this design refuses for tool
		// arguments. All-zero trace-ids are invalid per W3C.
		check(
			'mcp_call_trace_format',
			sql`${table.traceId} IS NULL
			 OR (${table.traceId} ~ '^[0-9a-f]{32}$' AND ${table.traceId} <> repeat('0', 32))`,
		),

		// Dispatch timing cannot exist for a request that never reached a tool.
		check('mcp_call_dispatch_scope', sql`${table.dispatchMs} IS NULL OR ${table.stage} = 'tool'`),

		check(
			'mcp_call_durations',
			sql`${table.totalMs} >= 0 AND ${table.gateMs} >= 0
			 AND (${table.dispatchMs} IS NULL OR ${table.dispatchMs} >= 0)`,
		),

		// A row always stands for at least one real occurrence.
		check('mcp_call_observed', sql`${table.observedCount} >= 1`),

		// Backstops on every remaining caller-influenced text column. The recorder normalises these
		// first; this is the database-side floor under a recorder bug.
		check(
			'mcp_call_text_len',
			sql`(${table.toolName} IS NULL OR char_length(${table.toolName}) <= 64)
			 AND (${table.subject} IS NULL OR char_length(${table.subject}) <= 128)
			 AND (${table.requestedProtocolVersion} IS NULL OR char_length(${table.requestedProtocolVersion}) <= 32)
			 AND (${table.servedProtocolVersion} IS NULL OR char_length(${table.servedProtocolVersion}) <= 32)
			 AND char_length(${table.clientFamily}) <= 32
			 AND (${table.clientName} IS NULL OR char_length(${table.clientName}) <= 64)
			 AND (${table.clientVersion} IS NULL OR char_length(${table.clientVersion}) <= 32)
			 AND (${table.clientKey} IS NULL OR char_length(${table.clientKey}) <= 72)
			 AND char_length(${table.registryVersion}) <= 32`,
		),
	],
);

export type McpCallLogRow = typeof mcpCallLog.$inferSelect;
export type McpCallLogInsert = typeof mcpCallLog.$inferInsert;
