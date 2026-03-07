<script lang="ts">
	import { NavSection } from '$lib/components/composites';
	import FeedbackSection from '../_sections/FeedbackSection.svelte';
	import ContentSection from '../_sections/ContentSection.svelte';
	import NavigationSection from '../_sections/NavigationSection.svelte';

	const sections = [
		{ id: 'comp-feedback', label: 'Feedback' },
		{ id: 'comp-content', label: 'Content' },
		{ id: 'comp-navigation', label: 'Navigation' }
	];
</script>

<svelte:head>
	<title>Composites - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<FeedbackSection />
	<ContentSection />
	<NavigationSection />
</main>
