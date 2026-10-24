import { buildCatalog } from '#lib/server/patterns/catalog.ts';

export const load = () => {
	return { title: 'Pattern Library — Docs', catalog: buildCatalog() };
};
