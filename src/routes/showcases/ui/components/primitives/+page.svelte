<script lang="ts">
	import { SectionNav } from '$lib/components/composites';
	import ActionsSection from '../_sections/ActionsSection.svelte';
	import InputsSection from '../_sections/InputsSection.svelte';
	import DataDisplaySection from '../_sections/DataDisplaySection.svelte';
	import OverlaysSection from '../_sections/OverlaysSection.svelte';

	const sections = [
		{ id: 'prim-actions', label: 'Actions' },
		{ id: 'prim-inputs', label: 'Inputs' },
		{ id: 'prim-data-display', label: 'Data Display' },
		{ id: 'prim-overlays', label: 'Overlays' }
	];
</script>

<svelte:head>
	<title>Primitives - UI Showcase - Velociraptor</title>
</svelte:head>

<SectionNav {sections} />

<main class="content">
	<ActionsSection />
	<InputsSection />
	<DataDisplaySection />
	<OverlaysSection />
</main>
