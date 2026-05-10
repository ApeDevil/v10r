import type { Decision } from './types';

interface AuditContext {
	route: string;
	clientIp: string | null;
	userId?: string | null;
	userAgent?: string | null;
}

/** Structured log emitted on every blocked request — feeds dashboards/alerts. */
export function logBlocked(decision: Decision, ctx: AuditContext): void {
	if (decision.allowed) return;
	console.warn(
		JSON.stringify({
			event: 'abuse_blocked',
			layer: decision.layer,
			reason: decision.reason,
			status: decision.status,
			...ctx,
		}),
	);
}
