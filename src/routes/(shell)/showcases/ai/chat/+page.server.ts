import type { PageServerLoad } from './$types';
import { aiConfigured } from '$lib/server/ai';

export const load: PageServerLoad = async () => {
	return { configured: aiConfigured };
};
