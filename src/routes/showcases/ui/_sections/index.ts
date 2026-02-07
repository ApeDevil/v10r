import type { ComponentType } from 'svelte';

import TokensSection from './TokensSection.svelte';
import ActionsSection from './ActionsSection.svelte';
import InputsSection from './InputsSection.svelte';
import DataDisplaySection from './DataDisplaySection.svelte';
import OverlaysSection from './OverlaysSection.svelte';
import FeedbackSection from './FeedbackSection.svelte';
import ContentSection from './ContentSection.svelte';
import NavigationSection from './NavigationSection.svelte';
import FormsSection from './FormsSection.svelte';
import LayoutSection from './LayoutSection.svelte';

export interface Section {
	id: string;
	label: string;
	component: ComponentType;
}

export interface SectionGroup {
	id: string;
	label: string;
	sections: Section[];
}

export type ShowcaseEntry = Section | SectionGroup;

export function isSectionGroup(entry: ShowcaseEntry): entry is SectionGroup {
	return 'sections' in entry;
}

export function getAllSections(entries: ShowcaseEntry[]): Section[] {
	return entries.flatMap((entry) => (isSectionGroup(entry) ? entry.sections : [entry]));
}

export const showcase: ShowcaseEntry[] = [
	{
		id: 'primitives',
		label: 'Primitives',
		sections: [
			{ id: 'prim-actions', label: 'Actions', component: ActionsSection },
			{ id: 'prim-inputs', label: 'Inputs', component: InputsSection },
			{ id: 'prim-data-display', label: 'Data Display', component: DataDisplaySection },
			{ id: 'prim-overlays', label: 'Overlays', component: OverlaysSection }
		]
	},
	{
		id: 'composites',
		label: 'Composites',
		sections: [
			{ id: 'comp-feedback', label: 'Feedback', component: FeedbackSection },
			{ id: 'comp-content', label: 'Content', component: ContentSection },
			{ id: 'comp-navigation', label: 'Navigation', component: NavigationSection },
			{ id: 'comp-forms', label: 'Forms', component: FormsSection }
		]
	},
	{ id: 'tokens', label: 'Theme Tokens', component: TokensSection },
	{ id: 'layout', label: 'Layout', component: LayoutSection }
] as const;
