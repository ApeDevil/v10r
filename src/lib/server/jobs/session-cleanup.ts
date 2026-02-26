import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema/auth/_better-auth';
import { lt } from 'drizzle-orm';

export async function sessionCleanup(): Promise<number> {
	const deleted = await db
		.delete(session)
		.where(lt(session.expiresAt, new Date()))
		.returning({ id: session.id });

	return deleted.length;
}
