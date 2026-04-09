/**
 * Notification service — the main entry point for sending notifications.
 * Creates the in-app notification, pushes SSE, and routes to external channels.
 */

import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createNotification } from '$lib/server/db/notifications/mutations';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { createDeliveries } from './outbox';
import { routeToChannels } from './router';
import { notifyUser } from './stream';

type NotificationType = 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow';

interface SendInput {
	userId: string;
	actorId?: string;
	type: NotificationType;
	title: string;
	body?: string;
	entityRef?: string;
	groupKey?: string;
	actionUrl?: string;
}

async function routeExternal(notificationId: string, userId: string, type: NotificationType) {
	const channels = await routeToChannels(userId, type);
	if (channels.length === 0) return;

	const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);

	if (!u) return;

	await createDeliveries(notificationId, channels as ('email' | 'telegram' | 'discord')[]);
}

export const NotificationService = {
	async send(input: SendInput) {
		const notification = await createNotification(input);

		notifyUser(input.userId, {
			type: 'new',
			notification: {
				id: notification.id,
				type: notification.type,
				title: notification.title,
				body: notification.body,
				actionUrl: notification.actionUrl,
				createdAt: notification.createdAt.toISOString(),
			},
		});

		routeExternal(notification.id, input.userId, input.type).catch((err) =>
			console.error('[notifications] routing failed:', err),
		);

		return notification;
	},
};
