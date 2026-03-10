import { count, eq } from 'drizzle-orm';
import { MAX_CONVERSATIONS_PER_USER } from '$lib/server/config';
import { db } from '../index';
import { conversation } from '../schema/ai/conversation';

/** Check if user has hit conversation limit. Returns null if under limit, error message if at/over. */
export async function checkConversationLimit(userId: string): Promise<string | null> {
	const [result] = await db.select({ total: count() }).from(conversation).where(eq(conversation.userId, userId));
	return (result?.total ?? 0) < MAX_CONVERSATIONS_PER_USER
		? null
		: `Conversation limit reached (${MAX_CONVERSATIONS_PER_USER}). Delete old conversations to continue.`;
}
