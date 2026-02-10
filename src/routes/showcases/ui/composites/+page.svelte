<script lang="ts">
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import FeedbackSection from '../_sections/FeedbackSection.svelte';
	import ContentSection from '../_sections/ContentSection.svelte';
	import NavigationSection from '../_sections/NavigationSection.svelte';
	import FormsSection from '../_sections/FormsSection.svelte';

	const sections = [
		{ id: 'comp-feedback', label: 'Feedback' },
		{ id: 'comp-content', label: 'Content' },
		{ id: 'comp-navigation', label: 'Navigation' },
		{ id: 'comp-forms', label: 'Forms' }
	];
</script>

<svelte:head>
	<title>Composites - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Composites"
		description="Alerts, toasts, cards, navigation, pagination, and form patterns."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Composites' }
		]}
	/>

	<SectionNav {sections} />

	<main class="content">
		<FeedbackSection />
		<ContentSection />
		<NavigationSection />
		<FormsSection />
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
