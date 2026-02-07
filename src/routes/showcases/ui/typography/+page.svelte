<script lang="ts">
	import { PageHeader } from '$lib/components/composites';
	import { Typography } from '$lib/components';
	import { DemoCard } from '../_components';
</script>

<svelte:head>
	<title>Typography - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Typography"
		description="Text styles and semantic elements for consistent typographic hierarchy."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Typography' }
		]}
	/>

	<main class="content">
		<DemoCard title="Typography Variants" description="Text styles and semantic elements">
			<div class="typography-demos">
				<Typography variant="h1">Heading 1</Typography>
				<Typography variant="h2">Heading 2</Typography>
				<Typography variant="h3">Heading 3</Typography>
				<Typography variant="body">Body text paragraph with normal styling.</Typography>
				<Typography variant="lead">Lead text for introductions.</Typography>
				<Typography variant="muted">Muted secondary text.</Typography>
				<Typography variant="code">const x = 42;</Typography>
			</div>
		</DemoCard>
	</main>
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

	.typography-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		width: 100%;
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
