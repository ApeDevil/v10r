/**
 * Blog tag visual config — maps domain/category slugs to visual properties.
 * Visual metadata lives here (not in DB) because it's never queried and changes rarely.
 * Follows the same pattern as $lib/config/models.ts.
 */

export interface DomainConfig {
	slug: string;
	name: string;
	icon: string;
	chartColor: number;
}

export interface CategoryConfig {
	slug: string;
	name: string;
	glyph: string;
}

export const DOMAINS: DomainConfig[] = [
	{ slug: 'engineering', name: 'Engineering', icon: 'i-lucide-code', chartColor: 1 },
	{ slug: 'design', name: 'Design', icon: 'i-lucide-palette', chartColor: 2 },
	{ slug: 'ai', name: 'AI', icon: 'i-lucide-brain', chartColor: 3 },
	{ slug: 'devops', name: 'DevOps', icon: 'i-lucide-container', chartColor: 4 },
	{ slug: 'product', name: 'Product', icon: 'i-lucide-box', chartColor: 5 },
	{ slug: 'culture', name: 'Culture', icon: 'i-lucide-users', chartColor: 6 },
];

export const CATEGORIES: CategoryConfig[] = [
	{ slug: 'tutorial', name: 'Tutorial', glyph: '\u2192' },
	{ slug: 'deep-dive', name: 'Deep Dive', glyph: '\u221E' },
	{ slug: 'series', name: 'Series', glyph: '\u00A7' },
	{ slug: 'quick-take', name: 'Quick Take', glyph: '\u203A' },
	{ slug: 'announcement', name: 'Announcement', glyph: '\u25C6' },
	{ slug: 'opinion', name: 'Opinion', glyph: '\u201C' },
	{ slug: 'reference', name: 'Reference', glyph: '#' },
	{ slug: 'case-study', name: 'Case Study', glyph: '@' },
	{ slug: 'retrospective', name: 'Retrospective', glyph: '\u2190' },
	{ slug: 'experiment', name: 'Experiment', glyph: '\u00B1' },
];

export const DOMAINS_BY_SLUG = new Map(DOMAINS.map((d) => [d.slug, d]));
export const CATEGORIES_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export interface ResolvedTagVisuals {
	label: string;
	icon?: string;
	glyph?: string;
	chartColor?: number;
	shape: 'pill' | 'rounded';
}

export function resolveBlogTagVisuals(
	tag: { slug: string; name: string },
	tier: 'domain' | 'category',
): ResolvedTagVisuals {
	if (tier === 'domain') {
		const config = DOMAINS_BY_SLUG.get(tag.slug);
		return {
			label: tag.name,
			icon: config?.icon,
			chartColor: config?.chartColor,
			shape: 'pill',
		};
	}
	const config = CATEGORIES_BY_SLUG.get(tag.slug);
	return {
		label: tag.name,
		glyph: config?.glyph,
		shape: 'rounded',
	};
}
