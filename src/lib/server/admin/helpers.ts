import type { RequestEvent } from '@sveltejs/kit';

/** Extract audit context from an authenticated admin request. Call only after requireAdmin(). */
export function getAuditContext(event: RequestEvent) {
	const user = event.locals.user!;
	return {
		actorId: user.id,
		actorEmail: user.email,
		ipAddress: event.getClientAddress(),
	};
}
