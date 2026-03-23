import { json } from '@sveltejs/kit';
import { dismissAnnouncement, getAnnouncementById } from '$lib/server/admin/announcements';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	// CSRF check
	if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const announcement = await getAnnouncementById(params.id);
	if (!announcement) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	await dismissAnnouncement(params.id, locals.user.id, announcement.severity);

	return json({ success: true });
};
