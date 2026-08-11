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

export const ANALYTICS_RANGES = ['7', '30', '90'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** `?range=7|30|90` for the analytics-family dashboards, default 30. Invalid values fall back rather than error — a mistyped bookmark should still render a dashboard. */
export function parseAnalyticsRange(url: URL): { range: AnalyticsRange; days: number } {
	const raw = url.searchParams.get('range');
	const range = ANALYTICS_RANGES.includes(raw as AnalyticsRange) ? (raw as AnalyticsRange) : '30';
	return { range, days: Number(range) };
}
