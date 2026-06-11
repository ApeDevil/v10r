import { eq } from 'drizzle-orm';
import { db } from '../index';
import { userPreferences } from '../schema/app/user-preferences';

/** Read-only preferences fetch (no row creation — for transparency/export surfaces). */
export async function getPreferences(userId: string) {
	const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
	return row ?? null;
}
