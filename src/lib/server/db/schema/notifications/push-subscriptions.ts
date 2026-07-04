/**
 * PUSH SUBSCRIPTIONS — Web Push endpoints per user + device/browser.
 * One user has N subscriptions (phone, laptop, …); the endpoint is the
 * device-unique key. p256dh/auth are the client's encryption keys — treated
 * as sensitive (with our VAPID private key they permit pushing to the device).
 */

import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { notificationsSchema } from './notifications';

export const pushSubscriptions = notificationsSchema.table(
	'push_subscriptions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
	},
	(table) => [index('push_subscription_user_idx').on(table.userId)],
);
