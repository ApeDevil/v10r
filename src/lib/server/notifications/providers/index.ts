import type { NotificationProvider } from './types';
import { EmailProvider } from './email';
import { TelegramProvider } from './telegram';
import { DiscordProvider } from './discord';

export type { NotificationProvider, DeliveryPayload, DeliveryResult } from './types';

const providers = new Map<string, NotificationProvider>([
	['email', new EmailProvider()],
	['telegram', new TelegramProvider()],
	['discord', new DiscordProvider()],
]);

export function getProvider(channel: string): NotificationProvider | undefined {
	return providers.get(channel);
}

export function registerProvider(channel: string, provider: NotificationProvider) {
	providers.set(channel, provider);
}
