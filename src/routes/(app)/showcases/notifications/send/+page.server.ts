import { fail, redirect } from '@sveltejs/kit';
import { NotificationService } from '$lib/server/notifications/service';
import type { Actions, PageServerLoad } from './$types';

const PRESETS: Record<string, { title: string; body: string }> = {
	mention: { title: 'You were mentioned in a discussion', body: 'Someone tagged you in a comment thread.' },
	comment: { title: 'New comment on your post', body: 'A user left feedback on your recent post.' },
	system: { title: 'System maintenance scheduled', body: 'A brief maintenance window is planned for tonight.' },
	success: { title: 'Your export completed successfully', body: 'The file is ready to download.' },
	security: { title: 'New login from a new device', body: 'We detected a login from an unrecognized browser.' },
	follow: { title: 'Someone started following you', body: 'You have a new follower on your profile.' },
};

const VALID_TYPES = Object.keys(PRESETS);

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/login');

	return {
		title: 'Send - Notifications - Showcases',
		userId: locals.user.id,
		userName: locals.user.name,
		notificationTypes: VALID_TYPES,
	};
};

export const actions: Actions = {
	quickSend: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const type = formData.get('type')?.toString();

		if (!type || !VALID_TYPES.includes(type)) {
			return fail(400, { error: 'Invalid notification type' });
		}

		const preset = PRESETS[type];
		const notification = await NotificationService.send({
			userId: locals.user.id,
			type: type as 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow',
			title: preset.title,
			body: preset.body,
		});

		return { sent: true, type, notificationId: notification.id };
	},

	customSend: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const type = formData.get('type')?.toString();
		const title = formData.get('title')?.toString()?.trim();
		const body = formData.get('body')?.toString()?.trim() || undefined;

		if (!type || !VALID_TYPES.includes(type)) {
			return fail(400, { error: 'Invalid notification type' });
		}

		if (!title) {
			return fail(400, { error: 'Title is required' });
		}

		const notification = await NotificationService.send({
			userId: locals.user.id,
			type: type as 'mention' | 'comment' | 'system' | 'success' | 'security' | 'follow',
			title,
			body,
		});

		return { sent: true, type, notificationId: notification.id };
	},
};
