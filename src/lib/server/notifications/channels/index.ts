import { DiscordChannel } from './discord';
import { EmailChannel } from './email';
import { TelegramChannel } from './telegram';
import type { DeliveryChannel } from './types';
import { WebPushChannel } from './web-push';

export type { DeliveryChannel, DeliveryPayload, DeliveryResult } from './types';

const channels = new Map<string, DeliveryChannel>([
	['email', new EmailChannel()],
	['telegram', new TelegramChannel()],
	['discord', new DiscordChannel()],
	['push', new WebPushChannel()],
]);

export function getChannel(channel: string): DeliveryChannel | undefined {
	return channels.get(channel);
}
