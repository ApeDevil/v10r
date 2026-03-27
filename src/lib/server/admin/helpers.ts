import type { RequestEvent } from '@sveltejs/kit';

export function getAuditContext(event: RequestEvent) {
	const user = event.locals.user;
	return {
		actorId: user!.id,
		actorEmail: user!.email,
		ipAddress: event.getClientAddress(),
	};
}
