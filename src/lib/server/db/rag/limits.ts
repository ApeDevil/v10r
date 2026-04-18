import { MAX_DOCUMENTS_PER_USER } from '$lib/server/rawrag/config';
import { countDocuments } from './queries';

/** Check if user has hit document limit. Returns null if under limit, error message if at/over. */
export async function checkDocumentLimit(userId: string): Promise<string | null> {
	const total = await countDocuments(userId);
	return total < MAX_DOCUMENTS_PER_USER
		? null
		: `Document limit reached (${MAX_DOCUMENTS_PER_USER}). Delete old documents to continue.`;
}
