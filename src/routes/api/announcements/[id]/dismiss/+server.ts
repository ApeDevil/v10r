import { dismissAnnouncement, getAnnouncementById } from '$lib/server/admin/announcements';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiNoContent } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:announcements:dismiss', 60, '1 m');

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const announcement = await getAnnouncementById(params.id);
	if (!announcement) return apiError(404, 'not_found', 'Announcement not found');

	await dismissAnnouncement(params.id, user.id, announcement.severity);

	return apiNoContent();
};
