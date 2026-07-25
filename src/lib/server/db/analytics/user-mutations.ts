/**
 * Authenticated-lane writes. Separate module from `mutations.ts` so the two
 * lanes do not share a call site — the wall between them is easier to keep
 * intact when nothing imports both and could accidentally pass a `visitorId`
 * where a `userId` belongs.
 */

import { db } from '$lib/server/db';
import { userEvents } from '$lib/server/db/schema/analytics';

/** Record one authenticated event. Idempotent on `eventId` when supplied. */
export async function recordUserEvent(event: {
	eventId?: string;
	userId: string;
	surface: 'account';
	eventType: 'pageview' | 'action' | 'error' | 'timing';
	route: string;
	path: string;
	metadata?: Record<string, string | number | boolean>;
	occurredAt?: Date;
}) {
	const insert = db.insert(userEvents).values({
		eventId: event.eventId ?? null,
		userId: event.userId,
		surface: event.surface,
		eventType: event.eventType,
		route: event.route,
		path: event.path,
		metadata: event.metadata ?? null,
		...(event.occurredAt ? { timestamp: event.occurredAt } : {}),
	});

	if (event.eventId) {
		await insert.onConflictDoNothing({ target: userEvents.eventId });
	} else {
		await insert;
	}
}
