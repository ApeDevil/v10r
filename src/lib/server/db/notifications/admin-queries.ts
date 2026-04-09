/**
 * Admin notification queries — read-only views over delivery data
 * for the admin notifications dashboard.
 */

import { and, count, desc, eq, gte, max, sql } from 'drizzle-orm';
import { ADMIN_DELIVERY_PAGE_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { notifications } from '$lib/server/db/schema/notifications/notifications';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';

// Per-user error codes excluded from channel health calculation
const PER_USER_ERROR_CODES = ['50007', '403'];

// ── Channel Health Stats ─────────────────────────────────────────────────────

export interface ChannelHealthStats {
	channel: string;
	sent: number;
	systemFailures: number;
	userFailures: number;
	dead: number;
	lastSentAt: Date | null;
}

export async function getChannelHealthStats(): Promise<ChannelHealthStats[]> {
	const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

	const rows = await db
		.select({
			channel: notificationDeliveries.channel,
			sent: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'sent')`,
			systemFailures: sql<number>`count(*) filter (where ${notificationDeliveries.status} IN ('failed', 'dead')
				AND (${notificationDeliveries.errorCode} IS NULL OR ${notificationDeliveries.errorCode} NOT IN (${sql.join(
					PER_USER_ERROR_CODES.map((c) => sql`${c}`),
					sql`, `,
				)})))`,
			userFailures: sql<number>`count(*) filter (where ${notificationDeliveries.status} IN ('failed', 'dead')
				AND ${notificationDeliveries.errorCode} IN (${sql.join(
					PER_USER_ERROR_CODES.map((c) => sql`${c}`),
					sql`, `,
				)}))`,
			dead: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'dead')`,
			lastSentAt: max(notificationDeliveries.sentAt),
		})
		.from(notificationDeliveries)
		.where(gte(notificationDeliveries.createdAt, cutoff))
		.groupBy(notificationDeliveries.channel);

	return rows.map((r) => ({
		channel: r.channel,
		sent: Number(r.sent),
		systemFailures: Number(r.systemFailures),
		userFailures: Number(r.userFailures),
		dead: Number(r.dead),
		lastSentAt: r.lastSentAt,
	}));
}

// ── Delivery Log ─────────────────────────────────────────────────────────────

export interface DeliveryLogFilters {
	channel?: string;
	status?: string;
	page?: number;
}

export interface DeliveryLogEntry {
	id: string;
	channel: string;
	status: string;
	notificationTitle: string;
	notificationType: string;
	errorCode: string | null;
	errorMessage: string | null;
	attempts: number;
	attemptedAt: Date | null;
	sentAt: Date | null;
	createdAt: Date;
}

export async function getDeliveryLog(filters: DeliveryLogFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const offset = (page - 1) * ADMIN_DELIVERY_PAGE_SIZE;

	const conditions = [];
	if (filters.channel && filters.channel !== 'all') {
		conditions.push(eq(notificationDeliveries.channel, filters.channel as 'email' | 'telegram' | 'discord'));
	}
	if (filters.status && filters.status !== 'all') {
		conditions.push(
			eq(
				notificationDeliveries.status,
				filters.status as 'pending' | 'processing' | 'sent' | 'failed' | 'skipped' | 'retrying' | 'dead',
			),
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [entries, totalResult] = await Promise.all([
		db
			.select({
				id: notificationDeliveries.id,
				channel: notificationDeliveries.channel,
				status: notificationDeliveries.status,
				notificationTitle: notifications.title,
				notificationType: notifications.type,
				errorCode: notificationDeliveries.errorCode,
				errorMessage: notificationDeliveries.errorMessage,
				attempts: notificationDeliveries.attempts,
				attemptedAt: notificationDeliveries.attemptedAt,
				sentAt: notificationDeliveries.sentAt,
				createdAt: notificationDeliveries.createdAt,
			})
			.from(notificationDeliveries)
			.innerJoin(notifications, eq(notificationDeliveries.notificationId, notifications.id))
			.where(where)
			.orderBy(desc(notificationDeliveries.createdAt))
			.limit(ADMIN_DELIVERY_PAGE_SIZE)
			.offset(offset),
		db.select({ total: count() }).from(notificationDeliveries).where(where),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		entries,
		total,
		page,
		totalPages: Math.max(1, Math.ceil(total / ADMIN_DELIVERY_PAGE_SIZE)),
	};
}

// ── Dead Deliveries (Needs Attention) ────────────────────────────────────────

export async function getDeadDeliveries() {
	return db
		.select({
			id: notificationDeliveries.id,
			channel: notificationDeliveries.channel,
			notificationTitle: notifications.title,
			errorCode: notificationDeliveries.errorCode,
			errorMessage: notificationDeliveries.errorMessage,
			attempts: notificationDeliveries.attempts,
			createdAt: notificationDeliveries.createdAt,
		})
		.from(notificationDeliveries)
		.innerJoin(notifications, eq(notificationDeliveries.notificationId, notifications.id))
		.where(eq(notificationDeliveries.status, 'dead'))
		.orderBy(desc(notificationDeliveries.createdAt))
		.limit(20);
}

// ── Connected Accounts ───────────────────────────────────────────────────────

export async function getConnectedAccountsCounts() {
	const [discord, telegram] = await Promise.all([
		db.select({ total: count() }).from(userDiscordAccounts).where(eq(userDiscordAccounts.isActive, true)),
		db.select({ total: count() }).from(userTelegramAccounts).where(eq(userTelegramAccounts.isActive, true)),
	]);

	return {
		discord: discord[0]?.total ?? 0,
		telegram: telegram[0]?.total ?? 0,
	};
}
