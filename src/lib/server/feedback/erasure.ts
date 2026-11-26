/**
 * Account erasure, the feedback part. Called by the privacy domain inside its erasure
 * transaction, before the user row goes (docs/blueprint/feedback/request-driven-development.md
 * §R.1).
 *
 * - A row that never held engineering state is the submitter's alone: the user row's delete
 *   cascades it away.
 * - A row in ENGINEERING_STATUSES (the development slot, or released) stays, as a shell: it is
 *   unlinked and every column that could identify or correlate with the submitter is cleared
 *   or coarsened. What remains is engineering continuity: status, category, the route
 *   pattern (no parameter values by construction), the app version, and the admin's
 *   development record.
 *
 * The rows are locked first. A development approval running at the same moment either
 * commits before the lock (and the row is shelled, keeping the slot) or waits and then finds
 * the row gone — the cascade can never delete a row that entered development mid-erasure.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DbHandle } from '#lib/server/db/index.ts';
import { ENGINEERING_STATUSES, feedback } from '#lib/server/db/schema/feedback/index.ts';

export async function eraseSubmitterFeedback(tx: DbHandle, userId: string): Promise<{ shelled: number }> {
	await tx.select({ id: feedback.id }).from(feedback).where(eq(feedback.userId, userId)).for('update');

	const shelled = await tx
		.update(feedback)
		.set({
			userId: null,
			subject: '',
			body: '',
			rating: null,
			contactEmail: null,
			pageOfOrigin: '',
			// The analytics journey and the error reference both join to logs about the person.
			sessionId: null,
			errorId: null,
			// The nonce identified one browser's form render; a fresh random value keeps the
			// unique column filled and means nothing.
			nonce: sql`gen_random_uuid()::text`,
			// The exact second correlates with request logs; the day is enough for engineering.
			submittedAt: sql`date_trunc('day', ${feedback.submittedAt})`,
			// The note may hold what the admin learned about the person.
			triageNote: null,
			erasedAt: new Date(),
		})
		.where(and(eq(feedback.userId, userId), inArray(feedback.status, [...ENGINEERING_STATUSES])))
		.returning({ id: feedback.id });
	return { shelled: shelled.length };
}
