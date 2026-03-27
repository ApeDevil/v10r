import { activeProviderInfo, aiConfigured } from '$lib/server/ai';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		configured: aiConfigured,
		provider: activeProviderInfo,
	};
};
