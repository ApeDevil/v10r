/**
 * Consent audit trail — records every consent grant, change, and withdrawal.
 */
import { db } from '$lib/server/db';
import { consentEvents } from '$lib/server/db/schema/analytics';

export async function recordConsentEvent(event: {
	visitorId: string;
	action: 'grant' | 'change' | 'withdraw';
	tierBefore: 'necessary' | 'analytics' | 'full' | null;
	tierAfter: 'necessary' | 'analytics' | 'full';
	uaHash?: string;
}) {
	await db.insert(consentEvents).values({
		visitorId: event.visitorId,
		action: event.action,
		tierBefore: event.tierBefore ?? null,
		tierAfter: event.tierAfter,
		uaHash: event.uaHash ?? null,
	});
}
