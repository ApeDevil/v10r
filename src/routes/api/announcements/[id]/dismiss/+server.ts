import { dismissAnnouncement, getAnnouncementById } from '$lib/server/admin/announcements';
import { apiError, apiNoContent } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const announcement = await getAnnouncementById(params.id);
	if (!announcement) return apiError(404, 'not_found', 'Announcement not found');

	await dismissAnnouncement(params.id, user.id, announcement.severity);

	return apiNoContent();
};
