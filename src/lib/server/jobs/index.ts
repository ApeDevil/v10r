import { aiTelemetryRetention } from './ai-telemetry-retention';
import { analyticsCleanup } from './analytics-cleanup';
import { analyticsRollup } from './analytics-rollup';
import { auditLogRetention } from './audit-log-retention';
import { blogOrphanReaper } from './blog-orphan-reaper';
import { botHitsFlush } from './bot-hits-flush';
import { botRangesRefresh } from './bot-ranges-refresh';
import { dbopsReaper } from './dbops-reaper';
import { dbopsRefresh } from './dbops-refresh';
import { deskRetention } from './desk-retention';
import { deskRetrievalSync } from './desk-retrieval-sync';
import { discordTokenRefresh } from './discord-token-refresh';
import { grantRequestExpiry } from './grant-request-expiry';
import { logCleanup } from './log-cleanup';
import { mcpTelemetryRetention } from './mcp-telemetry-retention';
import { notificationCleanup } from './notification-cleanup';
import { notificationDelivery } from './notification-delivery';
import { notificationDigest } from './notification-digest';
import { sessionCleanup } from './session-cleanup';
import { telegramTokenCleanup } from './telegram-token-cleanup';

export interface Job {
	execute: () => Promise<number>;
	/**
	 * How often the job is due. `/api/cron/due` runs every daily job each day and adds
	 * the weekly ones on Sunday (UTC). Retention sweeps filter on absolute age, so a
	 * weekly window really means nominal-to-nominal+7d and a skipped Sunday is repaired
	 * by the next one.
	 */
	cadence: 'daily' | 'weekly';
	/**
	 * Keeps its own `vercel.json` cron entry instead of riding the due-jobs sweep.
	 * Reserved for work dominated by external network fetches — `bot-ranges-refresh`
	 * pulls ~10 operator and datacenter feeds and has taken 45 s — because the sweep
	 * has to fit inside Vercel Hobby's 60 s function ceiling with room to spare.
	 */
	standalone?: true;
}

/**
 * Insertion order IS the run order of the due-jobs sweep. Constraints worth knowing:
 *
 *  - `bot-hits-flush` first, so the crawler rows it lands are subject to the same
 *    cleanup and retention windows as everything else in the same run.
 *  - `analytics-rollup` before `analytics-cleanup`: compute yesterday, then delete.
 *  - `notification-digest` before `notification-delivery`: the digest builds the rows
 *    the delivery drains, so subscribers get their digest in the same run.
 *  - `dbops-refresh` before `dbops-reaper`: a run started here still holds its lease
 *    when the reaper looks.
 */
export const jobs: Record<string, Job> = {
	'bot-hits-flush': { execute: botHitsFlush, cadence: 'daily' },
	'analytics-rollup': { execute: analyticsRollup, cadence: 'daily' },
	'analytics-cleanup': { execute: analyticsCleanup, cadence: 'daily' },
	'session-cleanup': { execute: sessionCleanup, cadence: 'daily' },
	'grant-request-expiry': { execute: grantRequestExpiry, cadence: 'daily' },
	'telegram-token-cleanup': { execute: telegramTokenCleanup, cadence: 'daily' },
	'discord-token-refresh': { execute: discordTokenRefresh, cadence: 'daily' },
	'notification-cleanup': { execute: notificationCleanup, cadence: 'daily' },
	// Builds deliveries for digest subscribers, whose instant enqueue is suppressed
	// in routeExternal.
	'notification-digest': { execute: notificationDigest, cadence: 'daily' },
	// Outbox drain: on persistent platforms the 15s delivery scheduler owns this; on
	// Vercel (platform.persistent === false) this sweep is the ONLY driver — without
	// it, email/telegram/discord deliveries queue as pending forever.
	'notification-delivery': { execute: notificationDelivery, cadence: 'daily' },
	'desk-retrieval-sync': { execute: deskRetrievalSync, cadence: 'daily' },
	'blog-orphan-reaper': { execute: blogOrphanReaper, cadence: 'daily' },
	'dbops-refresh': { execute: dbopsRefresh, cadence: 'daily' },
	'dbops-reaper': { execute: dbopsReaper, cadence: 'daily' },
	'log-cleanup': { execute: logCleanup, cadence: 'weekly' },
	'desk-retention': { execute: deskRetention, cadence: 'weekly' },
	'ai-telemetry-retention': { execute: aiTelemetryRetention, cadence: 'weekly' },
	'mcp-telemetry-retention': { execute: mcpTelemetryRetention, cadence: 'weekly' },
	'audit-log-retention': { execute: auditLogRetention, cadence: 'weekly' },
	// Refreshes the published crawler prefixes behind `bot_hits.verification`. If
	// this stops running, verification degrades to `unchecked` — never to a false
	// `spoofed` — because the job replaces per source and only on a good fetch.
	'bot-ranges-refresh': { execute: botRangesRefresh, cadence: 'daily', standalone: true },
};

/** Slugs the due-jobs sweep runs on `date`, in registry order. Standalone jobs never appear. */
export function jobsDueOn(date: Date): string[] {
	const sunday = date.getUTCDay() === 0;
	return Object.entries(jobs)
		.filter(([, job]) => !job.standalone && (job.cadence === 'daily' || sunday))
		.map(([slug]) => slug);
}
