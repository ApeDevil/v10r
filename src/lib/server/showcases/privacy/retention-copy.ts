/**
 * Reader-facing copy for the public retention table.
 *
 * The FACTS — dataset, window, action, enforcing job — come from `retention/schedule.ts`
 * and are never restated here. This module carries only what a schedule entry cannot: an
 * icon and a sentence of plain-language explanation.
 *
 * Typed as `Record<RetentionRuleId, …>`, so adding a retention rule without explaining it
 * to the public is a compile error rather than a silently missing table row.
 */

import { type RetentionRuleId, retentionSchedule } from '$lib/server/retention';

interface RetentionCopy {
	icon: string;
	rationale: string;
}

const COPY: Record<RetentionRuleId, RetentionCopy> = {
	'analytics-events': {
		icon: 'i-lucide-activity',
		rationale:
			'Individual page views and journey transitions. Past this window, only the daily aggregate row survives.',
	},
	'analytics-sessions': {
		icon: 'i-lucide-users',
		rationale: 'Per-visit metadata: started_at, last_seen, consent_tier. Same window as events to keep the join clean.',
	},
	'analytics-user-events': {
		icon: 'i-lucide-user-check',
		rationale:
			'The signed-in lane. Kept longer than the anonymous lane because it answers how an account is used over time — and erased immediately, regardless of age, when the account is deleted.',
	},
	'consent-events': {
		icon: 'i-lucide-clipboard-check',
		rationale:
			'Proof of consent, or of its withdrawal. Thirteen months satisfies Art. 7(1) demonstrability without overshooting.',
	},
	'bot-hits': {
		icon: 'i-lucide-bot',
		rationale:
			'Crawler and agent traffic. Holds no identifier of any kind — no IP, no hash, no session — so the window is set by what makes crawl cadence legible, not by minimisation.',
	},
	'analytics-aggregates': {
		icon: 'i-lucide-bar-chart-3',
		rationale:
			'Pre-aggregated rollups (path / day / count). No individual visitor data, so they outlive the events they summarise.',
	},
	'ai-turn-bodies': {
		icon: 'i-lucide-eraser',
		rationale:
			'The prompt as assembled, the history outline, the tool definitions and each tool result are blanked first; what the turn considered, included and cited stays as ids and sizes.',
	},
	'ai-turns': {
		icon: 'i-lucide-cpu',
		rationale:
			'The turn record itself — outcome, timings, provider attempts, citations. The conversations and messages are untouched by this sweep.',
	},
	'ai-model-calls': {
		icon: 'i-lucide-cpu',
		rationale: 'Per-request model, token and duration telemetry behind the cost views.',
	},
	'ai-tool-calls': {
		icon: 'i-lucide-wrench',
		rationale:
			'Which tools each turn ran, with their arguments and outcome (the results themselves leave with the bodies).',
	},
	'admin-audit-log': {
		icon: 'i-lucide-scroll-text',
		rationale:
			'Append-only record of administrative actions. A long window on purpose — an audit trail that expires quickly is not much of an audit trail.',
	},
	'mcp-call-text': {
		icon: 'i-lucide-eraser',
		rationale:
			'Caller-supplied query text and trace id are blanked first, while the dimensional signal stays. Minimising by column before by row is what keeps the longer row window unremarkable.',
	},
	'mcp-call-log': {
		icon: 'i-lucide-plug',
		rationale:
			'The call row itself. By this point it carries no free text and no identifier at all — only tool, outcome, latency and registry version.',
	},
	'desk-trash': {
		icon: 'i-lucide-trash-2',
		rationale:
			'Files you have already deleted. A live file is never touched by this sweep; only the trash empties, and only after the window.',
	},
	'desk-revisions': {
		icon: 'i-lucide-history',
		rationale: 'Undo and version history for desk documents, pruned by age independently of the files themselves.',
	},
	'notifications-archive': {
		icon: 'i-lucide-archive',
		rationale: 'Read notifications leave your active list at this point. They are not deleted yet.',
	},
	'notifications-delete': {
		icon: 'i-lucide-bell-off',
		rationale: 'Archived notifications are removed entirely.',
	},
	'job-executions': {
		icon: 'i-lucide-list-checks',
		rationale:
			'Run history for the scheduled jobs — start time, status, row count. Operational only; it holds no personal data.',
	},
};

export interface RetentionTableRow {
	dataset: string;
	icon: string;
	days: number | null;
	policy: string;
	rationale: string;
}

const ACTION_POLICY = {
	delete: 'Hard DELETE on cron',
	redact: 'Columns nulled on cron',
	archive: 'Archived on cron',
} as const;

/**
 * Rows the schedule governs, in schedule order. Datasets with no age-based window at all —
 * user-authored content, self-expiring sessions — are appended by the page, because their
 * absence from the schedule is the honest statement about them.
 */
export function scheduledRetentionRows(): RetentionTableRow[] {
	return retentionSchedule.map((rule) => ({
		dataset: rule.dataset,
		days: rule.days,
		policy: ACTION_POLICY[rule.action],
		...COPY[rule.id],
	}));
}
