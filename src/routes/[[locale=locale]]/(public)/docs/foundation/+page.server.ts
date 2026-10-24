import { getManifest } from '#lib/server/docs/loader.ts';

export const load = () => {
	return { title: 'Foundation — Docs', entries: getManifest().foundation };
};
