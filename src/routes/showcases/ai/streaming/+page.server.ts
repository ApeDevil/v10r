import type { PageServerLoad } from './$types';
import { aiConfigured, activeProviderInfo } from '$lib/server/ai';

export const load: PageServerLoad = async () => {
	return {
		configured: aiConfigured,
		provider: activeProviderInfo,
	};
};
