<script lang="ts">
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import TokensSection from '../_sections/TokensSection.svelte';

	const sections = [
		{ id: 'tok-typography', label: 'Typography' },
		{ id: 'tok-spacing', label: 'Spacing' },
		{ id: 'tok-colors', label: 'Colors' },
		{ id: 'tok-color-combos', label: 'Combos' },
		{ id: 'tok-z-index', label: 'Z-Index' },
		{ id: 'tok-surfaces', label: 'Surfaces' },
		{ id: 'tok-radius', label: 'Radius' },
		{ id: 'tok-shadows', label: 'Shadows' },
		{ id: 'tok-icons', label: 'Icons' },
		{ id: 'tok-breakpoints', label: 'Breakpoints' },
		{ id: 'tok-containers', label: 'Containers' },
		{ id: 'tok-duration', label: 'Duration' },
		{ id: 'tok-layout', label: 'Layout' }
	];
</script>

<svelte:head>
	<title>Theme Tokens - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Theme Tokens"
		description="Colors, spacing, typography, icons, breakpoints, shadows, layout, and animation tokens."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Tokens' }
		]}
	/>

	<SectionNav {sections} />

	<main class="content">
		<TokensSection />
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
