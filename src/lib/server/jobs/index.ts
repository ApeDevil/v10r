import { analyticsCleanup } from './analytics-cleanup';
import { analyticsRollup } from './analytics-rollup';
import { dbopsReaper } from './dbops-reaper';
import { dbopsRefresh } from './dbops-refresh';
import { deskRawragSync } from './desk-rawrag-sync';
import { discordTokenRefresh } from './discord-token-refresh';
import { grantRequestExpiry } from './grant-request-expiry';
import { logCleanup } from './log-cleanup';
import { notificationCleanup } from './notification-cleanup';
import { sessionCleanup } from './session-cleanup';
import { telegramTokenCleanup } from './telegram-token-cleanup';

export interface Job {
	execute: () => Promise<number>;
}

export const jobs: Record<string, Job> = {
	'session-cleanup': { execute: sessionCleanup },
	'log-cleanup': { execute: logCleanup },
	'notification-cleanup': { execute: notificationCleanup },
	'telegram-token-cleanup': { execute: telegramTokenCleanup },
	'discord-token-refresh': { execute: discordTokenRefresh },
	'analytics-cleanup': { execute: analyticsCleanup },
	'analytics-rollup': { execute: analyticsRollup },
	'grant-request-expiry': { execute: grantRequestExpiry },
	'dbops-refresh': { execute: dbopsRefresh },
	'dbops-reaper': { execute: dbopsReaper },
	'desk-rawrag-sync': { execute: deskRawragSync },
};
