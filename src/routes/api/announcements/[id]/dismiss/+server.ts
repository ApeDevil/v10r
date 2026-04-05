import { requireApiUser } from '$lib/server/auth/guards';
import { apiNoContent, apiError } from '$lib/server/api/response';
import { dismissAnnouncement, getAnnouncementById } from '$lib/server/admin/announcements';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const announcement = await getAnnouncementById(params.id);
	if (!announcement) return apiError(404, 'not_found', 'Announcement not found');

	await dismissAnnouncement(params.id, user.id, announcement.severity);

	return apiNoContent();
};
