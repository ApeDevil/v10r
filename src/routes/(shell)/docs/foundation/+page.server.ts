import { getManifest } from '$lib/server/docs/loader';

export const load = () => {
	return { entries: getManifest().foundation };
};
