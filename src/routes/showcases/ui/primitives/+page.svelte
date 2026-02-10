<script lang="ts">
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
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

<div class="page">
	<PageHeader
		title="Primitives"
		description="Buttons, inputs, badges, avatars, dialogs, and other foundational UI elements."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Primitives' }
		]}
	/>

	<SectionNav {sections} />

	<main class="content">
		<ActionsSection />
		<InputsSection />
		<DataDisplaySection />
		<OverlaysSection />
	</main>

	<BackLink href="/showcases/ui" label="UI" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.content {
		padding-top: var(--spacing-7);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
