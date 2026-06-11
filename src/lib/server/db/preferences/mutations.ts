import { eq, isNull, sql } from 'drizzle-orm';
import { db } from '../index';
import { userPreferences } from '../schema/app/user-preferences';

/** Get or create user preferences (triple-read pattern for race safety) */
export async function getOrCreatePreferences(userId: string) {
	const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);

	if (existing) return existing;

	const [created] = await db.insert(userPreferences).values({ userId }).onConflictDoNothing().returning();

	// Race condition: another request may have inserted between select and insert
	if (!created) {
		const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
		return row;
	}

	return created;
}

/**
 * Cheap read for the first-signup gate: has this user seen the transparency page?
 * Row absent or transparencySeenAt NULL → not yet seen.
 */
export async function hasSeenTransparency(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ seenAt: userPreferences.transparencySeenAt })
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);
	return row?.seenAt != null;
}

/**
 * Atomically consume the first-signup transparency marker.
 * Returns true exactly ONCE per user — concurrent loads (e.g. SvelteKit
 * prefetch + navigation) race on the same statement and only one wins.
 *
 * INSERT path: first request ever for this user (no preferences row yet).
 * UPDATE path: row exists with transparencySeenAt NULL (e.g. created by
 * a preferences write before the user's first /app navigation).
 */
export async function consumeTransparencyMarker(userId: string): Promise<boolean> {
	const rows = await db
		.insert(userPreferences)
		.values({ userId, transparencySeenAt: new Date() })
		.onConflictDoUpdate({
			target: userPreferences.userId,
			set: { transparencySeenAt: sql`now()` },
			setWhere: isNull(userPreferences.transparencySeenAt),
		})
		.returning({ userId: userPreferences.userId });
	return rows.length > 0;
}

/** Update user preferences (partial update, auto-set updatedAt) */
export async function updatePreferences(
	userId: string,
	data: Partial<Omit<typeof userPreferences.$inferInsert, 'userId'>>,
) {
	const [row] = await db
		.update(userPreferences)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(userPreferences.userId, userId))
		.returning();
	return row;
}
