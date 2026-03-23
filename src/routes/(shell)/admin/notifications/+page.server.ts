import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '$lib/server/auth/guards';
import { recordAuditEvent, getAuditContext } from '$lib/server/admin';
import {
	createAnnouncement,
	deactivateAnnouncement,
	getAllAnnouncementsAdmin,
} from '$lib/server/admin/announcements';
import {
	getChannelHealthStats,
	getDeliveryLog,
	getDeadDeliveries,
	getConnectedAccountsCounts,
} from '$lib/server/db/notifications/admin-queries';
import { probeChannels } from '$lib/server/notifications/health';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import { db } from '$lib/server/db';
import { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const channel = url.searchParams.get('channel') || 'all';
	const status = url.searchParams.get('status') || 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// Eager: fast aggregate queries
	const [healthStats, deadEntries, announcements, connectedAccounts] = await Promise.all([
		getChannelHealthStats(),
		getDeadDeliveries(),
		getAllAnnouncementsAdmin(),
		getConnectedAccountsCounts(),
	]);

	return {
		healthStats,
		deadEntries,
		announcements,
		connectedAccounts,
		filters: { channel, status, page },
		// Deferred: live probes (external API, may be slow)
		liveProbes: safeDeferPromise(probeChannels(), { discord: null, telegram: null }),
		// Deferred: paginated delivery log
		deliveryLog: safeDeferPromise(
			getDeliveryLog({ channel, status, page }),
			{ entries: [], total: 0, page: 1, totalPages: 1 },
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

		const ctx = getAuditContext(event);
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

		const ctx = getAuditContext(event);
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

		await db
			.update(notificationDeliveries)
			.set({ status: 'pending', errorCode: null, errorMessage: null, attempts: 0 })
			.where(eq(notificationDeliveries.id, deliveryId));

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'notification.delivery.retry',
			targetType: 'delivery',
			targetId: deliveryId,
		});

		return { success: true, message: 'Delivery queued for retry.' };
	},
};
