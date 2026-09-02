import type { RequestEvent } from '@sveltejs/kit';

/**
 * Canonical client IP. Reads from event.locals.clientIp which is stamped once
 * in the securityHeaders handler from event.getClientAddress() — the platform
 * (Vercel) trusted source. Downstream code MUST use this rather than reading
 * x-forwarded-for or other headers directly: those are attacker-mutable until
 * the platform overwrites them, and conflicting reads create rate-limit
 * bypass vectors.
 */
export function getClientIp(event: RequestEvent): string | null {
	return event.locals.clientIp;
}
