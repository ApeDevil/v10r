<script lang="ts">
import { NavSection } from '$lib/components/composites';
import type { ComponentDoc } from '$lib/components/composites/info-dialog/types';
import ActionsSection from '../_sections/ActionsSection.svelte';
import DataDisplaySection from '../_sections/DataDisplaySection.svelte';
import InputsSection from '../_sections/InputsSection.svelte';
import OverlaysSection from '../_sections/OverlaysSection.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const sections = [
	{ id: 'prim-actions', label: 'Actions' },
	{ id: 'prim-inputs', label: 'Inputs' },
	{ id: 'prim-data-display', label: 'Data Display' },
	{ id: 'prim-overlays', label: 'Overlays' },
];

const actionsDocs: Record<string, ComponentDoc> = $derived({
	button: {
		name: 'Button',
		description: 'Interactive button element with CVA variant system.',
		props: [
			{
				name: 'variant',
				type: "'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'",
				default: "'default'",
				description: 'Visual style variant',
			},
			{ name: 'size', type: "'sm' | 'md' | 'lg' | 'icon'", default: "'md'", description: 'Size variant' },
			{ name: 'children', type: 'Snippet', required: true, description: 'Button content' },
			{ name: 'class', type: 'string', description: 'Additional CSS classes' },
			{ name: 'disabled', type: 'boolean', default: 'false', description: 'Disables interaction' },
			{ name: '...rest', type: 'HTMLButtonAttributes', description: 'Native button attributes (onclick, type, etc.)' },
		],
		source: data.sources?.button,
		notes:
			'CVA variants in `button.ts` define class markers. Scoped CSS in `Button.svelte` handles actual visual styling via `:global()` selectors targeting those markers.\n\nThis two-file pattern is needed because UnoCSS cannot reliably extract complex classes from `.ts` files.',
	},
	spinner: {
		name: 'Spinner',
		description: 'Animated loading indicator with size and color variants.',
		props: [
			{ name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'Spinner diameter' },
			{ name: 'variant', type: "'primary' | 'muted'", default: "'primary'", description: 'Color variant' },
			{ name: 'label', type: 'string', default: "'Loading'", description: 'Accessible label for screen readers' },
			{ name: 'class', type: 'string', description: 'Additional CSS classes' },
		],
		source: data.sources?.spinner,
	},
});
</script>
<NavSection {sections} />

<main class="content">
	<ActionsSection docs={actionsDocs} />
	<InputsSection />
	<DataDisplaySection />
	<OverlaysSection />
</main>
