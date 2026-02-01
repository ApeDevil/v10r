import type { ComponentType } from 'svelte';

import TokensSection from './TokensSection.svelte';
import ActionsSection from './ActionsSection.svelte';
import InputsSection from './InputsSection.svelte';
import FeedbackSection from './FeedbackSection.svelte';
import OverlaysSection from './OverlaysSection.svelte';
import DataSection from './DataSection.svelte';
import LayoutSection from './LayoutSection.svelte';

export interface Section {
	id: string;
	label: string;
	component: ComponentType;
}

export const sections: Section[] = [
	{ id: 'tokens', label: 'Theme Tokens', component: TokensSection },
	{ id: 'actions', label: 'Actions', component: ActionsSection },
	{ id: 'inputs', label: 'Inputs', component: InputsSection },
	{ id: 'feedback', label: 'Feedback', component: FeedbackSection },
	{ id: 'overlays', label: 'Overlays', component: OverlaysSection },
	{ id: 'data', label: 'Data', component: DataSection },
	{ id: 'layout', label: 'Layout', component: LayoutSection }
] as const;
