import { aiConfigured } from '$lib/server/ai';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	return { configured: aiConfigured };
};
