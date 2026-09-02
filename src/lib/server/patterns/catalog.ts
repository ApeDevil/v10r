/**
 * Projection of the pattern registry for the /docs/pattern-library section
 * index — the catalog page every visitor sees. Registry order is preserved
 * (groups → categories → records) and empty categories/groups are omitted, so
 * the page always mirrors `pattern-library/registry.json` with zero staleness:
 * unlike the generated per-pattern markdown pages, the catalog needs no
 * `patterns:build` run to be current.
 */
import { REGISTRY, type Registry } from './registry';

export interface CatalogPattern {
	id: string;
	title: string;
	tier: 'deep' | 'light';
	maturity: 'planned' | 'implemented' | 'proven';
	summary: string;
	href: string;
}

export interface CatalogCategory {
	title: string;
	patterns: CatalogPattern[];
}

export interface CatalogGroup {
	title: string;
	categories: CatalogCategory[];
}

export interface Catalog {
	groups: CatalogGroup[];
	counts: { total: number; deep: number; categories: number };
}

export function buildCatalog(registry: Registry = REGISTRY): Catalog {
	const groups: CatalogGroup[] = [];
	for (const group of registry.groups) {
		const categories: CatalogCategory[] = [];
		for (const category of registry.categories.filter((c) => c.group === group.id)) {
			const patterns = registry.patterns
				.filter((p) => p.category === category.id)
				.map((p) => ({
					id: p.id,
					title: p.title,
					tier: p.tier,
					maturity: p.maturity,
					summary: p.summary,
					href: `/docs/pattern-library/${p.id}`,
				}));
			if (patterns.length > 0) categories.push({ title: category.title, patterns });
		}
		if (categories.length > 0) groups.push({ title: group.title, categories });
	}
	return {
		groups,
		counts: {
			total: registry.patterns.length,
			deep: registry.patterns.filter((p) => p.tier === 'deep').length,
			categories: groups.reduce((n, g) => n + g.categories.length, 0),
		},
	};
}
