/**
 * RETENTION SCHEDULE — what this system keeps, for how long, and who enforces it.
 *
 * One entry per dataset that ages out. This is the single authority: the cron sweeps read
 * their windows from here, the public privacy page renders the same rows, and
 * `schedule.gate.test.ts` fails if a sweep hard-codes a window or names a job that does not
 * exist. Before this existed the windows lived in a shared constants file, the sweeps each
 * hard-coded their own subset, and the published page showed four of them — three
 * representations of one promise, kept in step by hand.
 *
 * Framework-free and dependency-free on purpose: policy is a leaf that `jobs/` reads, never
 * the other way round. Reader-facing wording is the adapter's job and lives in
 * `showcases/privacy/retention-copy.ts`, keyed by `id` — which is why `id` is stable and
 * never reused for a different dataset.
 */

/** What the sweep does to a row once it passes the window. */
export type RetentionAction =
	/** The row is removed. */
	| 'delete'
	/** The row survives; caller-supplied columns are nulled. */
	| 'redact'
	/** The row survives and is moved out of the active set. */
	| 'archive';

export interface RetentionRule {
	/** Stable key, joined to the public copy by `retention-copy.ts`. Never reuse one. */
	id: string;
	/** `<pgSchema>.<table>` the sweep operates on. */
	dataset: string;
	days: number;
	action: RetentionAction;
	/** Job slug that enforces this rule. Asserted against the jobs registry by the gate. */
	job: string;
}

export const retentionSchedule = [
	// Anonymous analytics lane. The shortest window of the three lanes because these
	// rows are pseudonymous personal data collected under consent.
	{ id: 'analytics-events', dataset: 'analytics.events', days: 60, action: 'delete', job: 'analytics-cleanup' },
	{ id: 'analytics-sessions', dataset: 'analytics.sessions', days: 60, action: 'delete', job: 'analytics-cleanup' },

	// Authenticated lane. Longer than the anonymous lane because the purpose differs:
	// this answers "how do our users use their account over time", which needs enough
	// history to see retention and seasonality. Bounded all the same — Art 5(1)(e) does
	// not stop applying because the basis is legitimate interest. Erasure is separate
	// and immediate: deleting the account cascades these rows away regardless of age.
	{
		id: 'analytics-user-events',
		dataset: 'analytics.user_events',
		days: 180,
		action: 'delete',
		job: 'analytics-cleanup',
	},

	// ~13 months, so consent remains demonstrable for a full annual cycle plus a month
	// (GDPR Art 7(1)).
	{ id: 'consent-events', dataset: 'analytics.consent_events', days: 395, action: 'delete', job: 'analytics-cleanup' },

	// Bot lane. Longer than the human lane on purpose: `bot_hits` contains no identifier
	// of any kind — no IP, no hash, no session — so no data-minimisation duty pulls the
	// window down, while the questions it answers (crawl cadence, did AI agents start
	// reading /llms.txt after a change) are only legible over months. Bounded regardless,
	// because an append-only table fed by anything that points itself at the site grows
	// without limit.
	{ id: 'bot-hits', dataset: 'analytics.bot_hits', days: 180, action: 'delete', job: 'analytics-cleanup' },

	// Rollups carry no row-level identifier, so they outlive the events they summarise.
	{
		id: 'analytics-aggregates',
		dataset: 'analytics.daily_page_stats',
		days: 365,
		action: 'delete',
		job: 'analytics-cleanup',
	},

	// Admin cost/usage views read this, so the window is long; the rows are telemetry,
	// not conversation content.
	{ id: 'ai-telemetry', dataset: 'ai.conversation_step', days: 180, action: 'delete', job: 'ai-telemetry-retention' },

	// Append-only growth table → bound it, but keep a long (compliance-ish) window.
	{ id: 'admin-audit-log', dataset: 'admin.audit_log', days: 365, action: 'delete', job: 'audit-log-retention' },

	// Minimise by COLUMN before minimising by row: the dimensional signal (tool, outcome,
	// latency, registry version) is not personal data and is what makes "did the miss rate
	// drop after v1.3?" answerable, whereas the retained query text may describe a third
	// party's project and the trace id only ever serves an incident lookup nobody will
	// file after a month.
	{ id: 'mcp-call-text', dataset: 'mcp.call_log', days: 30, action: 'redact', job: 'mcp-telemetry-retention' },
	// Longer than the text window because by then a row carries no free text and no
	// identifier of any kind, and "did last quarter's gaps get fixed" needs a quarter.
	{ id: 'mcp-call-log', dataset: 'mcp.call_log', days: 90, action: 'delete', job: 'mcp-telemetry-retention' },

	// Trash, not files: only rows already soft-deleted by the user age out here. A live
	// file (`deleted_at IS NULL`) is never touched, which is the guarantee
	// `retention.test.ts` pins first.
	{ id: 'desk-trash', dataset: 'desk.file', days: 30, action: 'delete', job: 'desk-retention' },
	// Undo/version history, pruned purely by age and independently of any file row.
	{ id: 'desk-revisions', dataset: 'desk.file_revision', days: 90, action: 'delete', job: 'desk-retention' },

	// Read notifications leave the active list first, then go entirely.
	{
		id: 'notifications-archive',
		dataset: 'notifications.notifications',
		days: 30,
		action: 'archive',
		job: 'notification-cleanup',
	},
	{
		id: 'notifications-delete',
		dataset: 'notifications.notifications',
		days: 90,
		action: 'delete',
		job: 'notification-cleanup',
	},

	// Job run history. Operational only — it holds no personal data, just enough history
	// to answer "when did this sweep last succeed".
	{ id: 'job-executions', dataset: 'jobs.job_execution', days: 90, action: 'delete', job: 'log-cleanup' },
] as const satisfies readonly RetentionRule[];

/**
 * The id set, as a type. A typo in `retentionCutoff('analytics-evnts')` is a compile
 * error rather than a throw at 03:00 when the cron fires.
 */
export type RetentionRuleId = (typeof retentionSchedule)[number]['id'];

/** Look up one rule. Throws rather than returning undefined — the type makes a miss unreachable. */
export function retentionRule(id: RetentionRuleId): RetentionRule {
	const rule = retentionSchedule.find((r) => r.id === id);
	if (!rule) throw new Error(`No retention rule '${id}' — see retention/schedule.ts`);
	return rule;
}

/** Days for one rule, the form every sweep actually wants. */
export function retentionDays(id: RetentionRuleId): number {
	return retentionRule(id).days;
}

/** Cutoff timestamp for one rule: rows older than this are due. */
export function retentionCutoff(id: RetentionRuleId, now: Date = new Date()): Date {
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - retentionDays(id));
	return cutoff;
}
