import type { PageServerLoad, Actions } from './$types';
import { verifyAIConnection, getProviderStatuses } from '$lib/server/ai/showcase/queries';

export const load: PageServerLoad = async () => {
	const [connection, providers] = await Promise.all([
		verifyAIConnection(),
		Promise.resolve(getProviderStatuses()),
	]);

	return {
		connection,
		providers,
		measuredAt: new Date().toISOString(),
	};
};

export const actions: Actions = {
	retest: async () => {
		const connection = await verifyAIConnection();

		return {
			connection,
			providers: getProviderStatuses(),
			measuredAt: new Date().toISOString(),
		};
	},
};
