import { buildCatalog } from '$lib/server/patterns/catalog';

export const load = () => {
	return { title: 'Pattern Library — Docs', catalog: buildCatalog() };
};
