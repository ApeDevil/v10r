/**
 * The docs hub's five sections — ONE list read by the hub page (cards) and the
 * navigation registry (the Docs flyout / drawer children), so the two cannot
 * drift: for two years the flyout listed one section while the hub showed five.
 * Order = display order.
 */

import type { LabelFn } from '$lib/nav/types';
import * as m from '$lib/paraglide/messages';

export interface DocsSection {
	href: `/docs/${string}`;
	icon: string;
	title: LabelFn;
	description: LabelFn;
}

export const DOCS_SECTIONS: DocsSection[] = [
	{
		href: '/docs/pattern-library',
		icon: 'i-lucide-library',
		title: m.docs_section_pattern_library_title,
		description: m.docs_section_pattern_library_description,
	},
	{
		href: '/docs/foundation',
		icon: 'i-lucide-compass',
		title: m.docs_section_foundation_title,
		description: m.docs_section_foundation_description,
	},
	{
		href: '/docs/stack',
		icon: 'i-lucide-layers',
		title: m.docs_section_stack_title,
		description: m.docs_section_stack_description,
	},
	{
		href: '/docs/blueprint',
		icon: 'i-lucide-map',
		title: m.docs_section_blueprint_title,
		description: m.docs_section_blueprint_description,
	},
	{
		href: '/docs/programming',
		icon: 'i-lucide-users-round',
		title: m.docs_card_agents_title,
		description: m.docs_card_agents_description,
	},
];
