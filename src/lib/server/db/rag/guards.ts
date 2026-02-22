import { countDocuments } from './mutations';
import { MAX_DOCUMENTS_PER_USER } from '$lib/server/retrieval/config';

/** Check if user has hit document limit. Returns true if under limit. */
export async function checkDocumentLimit(userId: string): Promise<boolean> {
	const total = await countDocuments(userId);
	return total < MAX_DOCUMENTS_PER_USER;
}
