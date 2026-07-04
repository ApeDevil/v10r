import { DiscordProvider } from './discord';
import { EmailProvider } from './email';
import { TelegramProvider } from './telegram';
import type { NotificationProvider } from './types';
import { WebPushProvider } from './web-push';

export type { DeliveryPayload, DeliveryResult, NotificationProvider } from './types';

const providers = new Map<string, NotificationProvider>([
	['email', new EmailProvider()],
	['telegram', new TelegramProvider()],
	['discord', new DiscordProvider()],
	['push', new WebPushProvider()],
]);

export function getProvider(channel: string): NotificationProvider | undefined {
	return providers.get(channel);
}
