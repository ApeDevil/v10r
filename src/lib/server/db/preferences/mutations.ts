import { eq } from 'drizzle-orm';
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
