import type { RequestEvent } from '@sveltejs/kit';

/** Extract audit context from an authenticated admin request. Call only after requireAdmin(). */
export function getAuditContext(event: RequestEvent) {
	const user = event.locals.user;
	if (!user) throw new Error('User required for audit context');
	return {
		actorId: user.id,
		actorEmail: user.email,
		ipAddress: event.getClientAddress(),
	};
}
