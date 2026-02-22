import { eq, count } from 'drizzle-orm';
import { db } from '../index';
import { conversation } from '../schema/ai/conversation';

const MAX_CONVERSATIONS_PER_USER = 50;

/** Check if user has hit conversation limit. Returns true if under limit. */
export async function checkConversationLimit(userId: string): Promise<boolean> {
	const [result] = await db
		.select({ total: count() })
		.from(conversation)
		.where(eq(conversation.userId, userId));
	return (result?.total ?? 0) < MAX_CONVERSATIONS_PER_USER;
}
