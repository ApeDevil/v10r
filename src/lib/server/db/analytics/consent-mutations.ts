/**
 * Consent audit trail — records every consent grant, change, and withdrawal.
 */

import { db } from '$lib/server/db';
import { consentEvents } from '$lib/server/db/schema/analytics';
import type { ConsentTier } from '$lib/types/db-enums';

export async function recordConsentEvent(event: {
	visitorId: string;
	action: 'grant' | 'change' | 'withdraw';
	tierBefore: ConsentTier | null;
	tierAfter: ConsentTier;
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
