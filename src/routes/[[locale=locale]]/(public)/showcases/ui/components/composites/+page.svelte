<script lang="ts">
import { NavSection } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import ContentSection from '../_sections/ContentSection.svelte';
import FeedbackSection from '../_sections/FeedbackSection.svelte';
import NavigationSection from '../_sections/NavigationSection.svelte';

const sections = $derived([
	{ id: 'comp-feedback', label: m.showcase_ui_composites_section_feedback() },
	{ id: 'comp-content', label: m.showcase_ui_composites_section_content() },
	{ id: 'comp-navigation', label: m.showcase_ui_composites_section_navigation() },
]);
</script>
<NavSection {sections} />

<main class="content">
	<FeedbackSection />
	<ContentSection />
	<NavigationSection />
</main>
