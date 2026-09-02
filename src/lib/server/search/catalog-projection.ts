/**
 * Catalog → graph projection.
 *
 * Derives a typed `Resource` graph (domains → modules → components, plus sections)
 * from the showcase registry + section registry — the authoritative source of the
 * project's component/module/domain structure. Pure and dependency-light (no DB, no
 * Vite `import.meta.glob`), so it runs unchanged inside a Bun sync script.
 *
 * Node ids are LOCALE-BARE and follow the `SearchRecord` id scheme
 * (`${surface}:${path}${anchor ?? ''}`) so a future retrieval soft-pointer
 * (`retrieval.document.sourceUri`) can reference the same node. Relative imports keep the
 * module resolvable both under Vite (app) and Bun (script).
 */
import type { SearchSurface } from '../../search/types';
import { type ShowcaseSublink, showcases } from '../../showcases/catalog/registry';
import { showcaseSections } from '../../showcases/catalog/sections';

export type ResourceKind = 'domain' | 'module' | 'component' | 'section';

export interface CatalogResourceNode {
	/** Locale-bare stable id: `${surface}:${path}${anchor ?? ''}`. */
	id: string;
	surface: SearchSurface;
	kind: ResourceKind;
	title: string;
	path: string;
	anchor: string | null;
}

export interface CatalogEdge {
	/** Child node id. */
	from: string;
	/** Parent node id. */
	to: string;
	type: 'PART_OF';
}

export interface CatalogGraph {
	resources: CatalogResourceNode[];
	edges: CatalogEdge[];
}

export function deriveCatalogGraph(): CatalogGraph {
	const nodes = new Map<string, CatalogResourceNode>();
	const edges: CatalogEdge[] = [];

	const showcaseId = (href: string) => `showcase:${href}`;

	const addShowcase = (href: string, title: string, kind: ResourceKind): string => {
		const id = showcaseId(href);
		if (!nodes.has(id)) {
			nodes.set(id, { id, surface: 'showcase', kind, title, path: href, anchor: null });
		}
		return id;
	};
	const addEdge = (from: string, to: string) => {
		if (from !== to) edges.push({ from, to, type: 'PART_OF' });
	};

	const walk = (links: ShowcaseSublink[], parentId: string, parentHref: string, kind: ResourceKind) => {
		for (const link of links) {
			// A sublink whose href equals its parent (e.g. "Overview") is the parent itself.
			if (link.href === parentHref) continue;
			const id = addShowcase(link.href, link.label(), kind);
			addEdge(id, parentId);
			if (link.children?.length) walk(link.children, id, link.href, 'component');
		}
	};

	// card = domain → sublink = module → child = component. Labels resolve via
	// Paraglide, which falls back to the base locale (English) under bare Bun.
	for (const card of showcases) {
		const domainId = addShowcase(card.href, card.title(), 'domain');
		walk(card.sublinks ?? [], domainId, card.href, 'module');
	}

	// Sections deep-link into a showcase page → PART_OF that page (when present).
	for (const section of showcaseSections) {
		const id = `section:${section.pageHref}#${section.anchorId}`;
		if (!nodes.has(id)) {
			nodes.set(id, {
				id,
				surface: 'section',
				kind: 'section',
				title: section.title,
				path: section.pageHref,
				anchor: `#${section.anchorId}`,
			});
		}
		const parentId = showcaseId(section.pageHref);
		if (nodes.has(parentId)) addEdge(id, parentId);
	}

	return { resources: [...nodes.values()], edges };
}
