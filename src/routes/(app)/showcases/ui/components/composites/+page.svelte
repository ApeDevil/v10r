<script lang="ts">
import { NavSection } from '$lib/components/composites';
import ContentSection from '../_sections/ContentSection.svelte';
import FeedbackSection from '../_sections/FeedbackSection.svelte';
import NavigationSection from '../_sections/NavigationSection.svelte';

const sections = [
	{ id: 'comp-feedback', label: 'Feedback' },
	{ id: 'comp-content', label: 'Content' },
	{ id: 'comp-navigation', label: 'Navigation' },
];
</script>
<NavSection {sections} />

<main class="content">
	<FeedbackSection />
	<ContentSection />
	<NavigationSection />
</main>
