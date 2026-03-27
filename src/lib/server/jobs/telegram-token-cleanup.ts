import { lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { telegramVerificationTokens } from '$lib/server/db/schema/notifications/telegram';

export async function telegramTokenCleanup(): Promise<number> {
	// Delete expired tokens older than 1 day
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 1);

	const deleted = await db
		.delete(telegramVerificationTokens)
		.where(lt(telegramVerificationTokens.expiresAt, cutoff))
		.returning({ id: telegramVerificationTokens.id });

	return deleted.length;
}
