import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { NotificationService } from '$lib/server/notifications/service';
import type { Actions, PageServerLoad } from './$types';

/**
 * Showcase preset → Paraglide message key mapping.
 * Each preset uses a stable `notif_*` key; render at viewer/delivery time
 * via `renderNotification` (`$lib/server/notifications/render-message`).
 */
const PRESETS: Record<string, string> = {
	mention: 'notif_mention',
	comment: 'notif_comment',
	system: 'notif_system',
	success: 'notif_success',
	security: 'notif_security',
	follow: 'notif_follow',
};

const VALID_TYPES = Object.keys(PRESETS);

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));

	return {
		title: 'Send - Notifications - Showcases',
		userId: locals.user.id,
		userName: locals.user.name,
		notificationTypes: VALID_TYPES,
	};
};

export const actions: Actions = {
	quickSend: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const type = formData.get('type')?.toString();

		if (!type || !VALID_TYPES.includes(type)) {
			return fail(400, { error: 'Invalid notification type' });
		}

		const notification = await NotificationService.send({
			userId: locals.user.id,
			type: type as 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow',
			messageKey: PRESETS[type],
			messageParams: {},
		});

		return { sent: true, type, notificationId: notification.id };
	},

	customSend: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const type = formData.get('type')?.toString();
		const customText = formData.get('title')?.toString()?.trim();

		if (!type || !VALID_TYPES.includes(type)) {
			return fail(400, { error: 'Invalid notification type' });
		}

		if (!customText) {
			return fail(400, { error: 'Title is required' });
		}

		// Custom showcase sends use the generic `notif_custom` template with the
		// supplied text as a parameter, demonstrating ICU interpolation.
		const notification = await NotificationService.send({
			userId: locals.user.id,
			type: type as 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow',
			messageKey: 'notif_custom',
			messageParams: { text: customText },
		});

		return { sent: true, type, notificationId: notification.id };
	},
};
