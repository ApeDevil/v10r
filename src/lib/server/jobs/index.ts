import { logCleanup } from './log-cleanup';
import { sessionCleanup } from './session-cleanup';
import { notificationCleanup } from './notification-cleanup';
import { notificationDelivery } from './notification-delivery';
import { telegramTokenCleanup } from './telegram-token-cleanup';
import { discordTokenRefresh } from './discord-token-refresh';
import { analyticsCleanup } from './analytics-cleanup';
import { analyticsRollup } from './analytics-rollup';

export interface Job {
	execute: () => Promise<number>;
}

export const jobs: Record<string, Job> = {
	'session-cleanup': { execute: sessionCleanup },
	'log-cleanup': { execute: logCleanup },
	'notification-cleanup': { execute: notificationCleanup },
	'notification-delivery': { execute: notificationDelivery },
	'telegram-token-cleanup': { execute: telegramTokenCleanup },
	'discord-token-refresh': { execute: discordTokenRefresh },
	'analytics-cleanup': { execute: analyticsCleanup },
	'analytics-rollup': { execute: analyticsRollup },
};
