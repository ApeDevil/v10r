/** Minimal shape `getAuditContext` needs off `event.locals.user` — framework-free by design. */
export interface AuditableUser {
	id: string;
	email: string;
}

/** Build audit context from an authenticated admin request's user + client IP. Call only after requireAdmin(). */
export function getAuditContext(user: AuditableUser | null | undefined, clientIp: string) {
	if (!user) throw new Error('User required for audit context');
	return {
		actorId: user.id,
		actorEmail: user.email,
		ipAddress: clientIp,
	};
}
