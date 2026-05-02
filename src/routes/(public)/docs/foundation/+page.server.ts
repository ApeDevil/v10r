import { getManifest } from '$lib/server/docs/loader';

export const load = () => {
	return { title: 'Foundation — Docs', entries: getManifest().foundation };
};
