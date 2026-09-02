import { fail } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { createAnnouncement, deactivateAnnouncement, getAllAnnouncementsAdmin } from '$lib/server/admin/announcements';
import { DELIVERY_PAGE_SIZE } from '$lib/server/admin/config';
import { db } from '$lib/server/db';
import {
	type DeadDeliveryEntry,
	type DeliveryLogEntry,
	getChannelHealthStats,
	getConnectedAccountsCounts,
	getDeadDeliveries,
	getDeliveryLog,
} from '$lib/server/db/notifications/admin-queries';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import { safeDeferPromise } from '$lib/server/http/defer';
import { requireAdmin } from '$lib/server/http/guards';
import { probeChannels } from '$lib/server/notifications/health';
import { renderNotification } from '$lib/server/notifications/render-message';
import type { Actions, PageServerLoad } from './$types';

/**
 * `getDeliveryLog`/`getDeadDeliveries` return raw `messageKey`/`messageParams` —
 * the db layer stays framework/i18n-agnostic. Rendering into a locale-specific
 * title is the route adapter's job (this is the "move it to the caller"
 * resolution for the db→notifications sideways import).
 */
function withRenderedTitle<T extends { messageKey: string; messageParams: Record<string, string | number> }>(
	row: T,
	locale: string,
): Omit<T, 'messageKey' | 'messageParams'> & { notificationTitle: string } {
	const { messageKey, messageParams, ...rest } = row;
	return { ...rest, notificationTitle: renderNotification(messageKey, messageParams, locale) };
}

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const channel = url.searchParams.get('channel') || 'all';
	const status = url.searchParams.get('status') || 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// Eager: fast aggregate queries
	const [healthStats, deadEntriesRaw, announcements, connectedAccounts] = await Promise.all([
		getChannelHealthStats(),
		getDeadDeliveries(),
		getAllAnnouncementsAdmin(),
		getConnectedAccountsCounts(),
	]);
	const deadEntries: (Omit<DeadDeliveryEntry, 'messageKey' | 'messageParams'> & { notificationTitle: string })[] =
		deadEntriesRaw.map((e) => withRenderedTitle(e, locals.locale));

	return {
		title: 'Notifications - Admin',
		healthStats,
		deadEntries,
		announcements,
		connectedAccounts,
		filters: { channel, status, page },
		// Deferred: live probes (external API, may be slow)
		liveProbes: safeDeferPromise(probeChannels(), { discord: null, telegram: null }),
		// Deferred: paginated delivery log
		deliveryLog: safeDeferPromise(
			getDeliveryLog({ channel, status, page, pageSize: DELIVERY_PAGE_SIZE }).then((result) => ({
				...result,
				entries: result.entries.map((e: DeliveryLogEntry) => withRenderedTitle(e, locals.locale)),
			})),
			{
				entries: [],
				total: 0,
				page: 1,
				totalPages: 1,
			},
		),
	};
};

export const actions: Actions = {
	createAnnouncement: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();

		const title = formData.get('title') as string;
		const body = formData.get('body') as string;
		const severity = formData.get('severity') as string;
		const startsAtRaw = formData.get('starts_at') as string;
		const endsAtRaw = formData.get('ends_at') as string;

		if (!title?.trim()) return fail(400, { message: 'Title is required' });
		if (!body?.trim()) return fail(400, { message: 'Body is required' });
		if (!['info', 'warning', 'critical'].includes(severity)) {
			return fail(400, { message: 'Invalid severity' });
		}
		if (title.length > 120) return fail(400, { message: 'Title must be 120 characters or fewer' });

		const ctx = getAuditContext(event.locals.user, event.getClientAddress());
		const announcement = await createAnnouncement({
			title: title.trim(),
			body: body.trim(),
			severity: severity as 'info' | 'warning' | 'critical',
			startsAt: startsAtRaw ? new Date(startsAtRaw) : null,
			endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
			createdBy: ctx.actorId,
		});

		await recordAuditEvent({
			...ctx,
			action: 'announcement.create',
			targetType: 'announcement',
			targetId: announcement.id,
			detail: { title: announcement.title, severity: announcement.severity },
		});

		return { success: true, message: 'Announcement published.' };
	},

	deactivateAnnouncement: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const id = formData.get('id') as string;

		if (!id) return fail(400, { message: 'Announcement ID required' });

		const ctx = getAuditContext(event.locals.user, event.getClientAddress());
		await deactivateAnnouncement(id);

		await recordAuditEvent({
			...ctx,
			action: 'announcement.deactivate',
			targetType: 'announcement',
			targetId: id,
		});

		return { success: true, message: 'Announcement deactivated.' };
	},

	retest: async ({ locals }) => {
		requireAdmin(locals);
		const probes = await probeChannels();
		return { probes };
	},

	retryDelivery: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const deliveryId = formData.get('delivery_id') as string;

		if (!deliveryId) return fail(400, { message: 'Delivery ID required' });

		// Terminal states only: never yank a row out from under a live worker
		// ('processing'), never double-queue one that is already scheduled ('pending').
		// 'failed' is retryable here alongside 'dead' so an operator can override a
		// mis-classified non-retryable error — that is the point of a manual button.
		// attempts: 0 deliberately grants a fresh budget, and next_attempt_at: now()
		// makes the row claimable on the next tick instead of inheriting a stale backoff.
		const [row] = await db
			.update(notificationDeliveries)
			.set({
				status: 'pending',
				errorCode: null,
				errorMessage: null,
				attempts: 0,
				attemptedAt: null,
				nextAttemptAt: new Date(),
			})
			.where(and(eq(notificationDeliveries.id, deliveryId), inArray(notificationDeliveries.status, ['dead', 'failed'])))
			.returning({ id: notificationDeliveries.id, channel: notificationDeliveries.channel });

		if (!row) {
			return fail(409, { message: 'Delivery is not in a retryable state (already queued or in flight).' });
		}

		const ctx = getAuditContext(event.locals.user, event.getClientAddress());
		await recordAuditEvent({
			...ctx,
			action: 'notification.delivery.retry',
			targetType: 'delivery',
			targetId: deliveryId,
			detail: { channel: row.channel },
		});

		return { success: true, message: 'Delivery queued for retry.' };
	},
};
