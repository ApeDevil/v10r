<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import TokensSection from '../_sections/TokensSection.svelte';
</script>

<svelte:head>
	<title>Theme Tokens - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Theme Tokens"
		description="Colors, spacing, typography scale, shadows, and border radii."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Tokens' }
		]}
	/>

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
