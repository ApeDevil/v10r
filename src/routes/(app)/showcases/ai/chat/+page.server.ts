import { aiConfigured } from '$lib/server/ai';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { title: 'Chat - AI - Showcases', configured: aiConfigured };
};
