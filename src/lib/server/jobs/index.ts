import { aiTelemetryRetention } from './ai-telemetry-retention';
import { analyticsCleanup } from './analytics-cleanup';
import { analyticsRollup } from './analytics-rollup';
import { auditLogRetention } from './audit-log-retention';
import { blogOrphanReaper } from './blog-orphan-reaper';
import { botRangesRefresh } from './bot-ranges-refresh';
import { dbopsReaper } from './dbops-reaper';
import { dbopsRefresh } from './dbops-refresh';
import { deskRawragSync } from './desk-rawrag-sync';
import { deskRetention } from './desk-retention';
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
}

export const jobs: Record<string, Job> = {
	'session-cleanup': { execute: sessionCleanup },
	'log-cleanup': { execute: logCleanup },
	'notification-cleanup': { execute: notificationCleanup },
	// Outbox drain: on persistent platforms the 15s interval scheduler owns this;
	// on Vercel (platform.persistent === false) the cron entry is the ONLY driver
	// — without it, email/telegram/discord deliveries queue as pending forever.
	'notification-delivery': { execute: notificationDelivery },
	// Builds deliveries for digest subscribers, whose instant enqueue is
	// suppressed in routeExternal. Runs at 07:00 so its rows are drained by the
	// 08:00 delivery cron the same morning.
	'notification-digest': { execute: notificationDigest },
	'telegram-token-cleanup': { execute: telegramTokenCleanup },
	'discord-token-refresh': { execute: discordTokenRefresh },
	'analytics-cleanup': { execute: analyticsCleanup },
	'analytics-rollup': { execute: analyticsRollup },
	// Refreshes the published crawler prefixes behind `bot_hits.verification`. If
	// this stops running, verification degrades to `unchecked` — never to a false
	// `spoofed` — because the job replaces per source and only on a good fetch.
	'bot-ranges-refresh': { execute: botRangesRefresh },
	'grant-request-expiry': { execute: grantRequestExpiry },
	'dbops-refresh': { execute: dbopsRefresh },
	'dbops-reaper': { execute: dbopsReaper },
	'desk-rawrag-sync': { execute: deskRawragSync },
	'desk-retention': { execute: deskRetention },
	'ai-telemetry-retention': { execute: aiTelemetryRetention },
	'mcp-telemetry-retention': { execute: mcpTelemetryRetention },
	'audit-log-retention': { execute: auditLogRetention },
	'blog-orphan-reaper': { execute: blogOrphanReaper },
};
