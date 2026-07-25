<script lang="ts">
import { NavSection } from '$lib/components/composites';
import ElevationSection from '../components/_sections/ElevationSection.svelte';
import LayoutSection from '../components/_sections/LayoutSection.svelte';

// Labels mirror the hardcoded English <h2>s in the section components, matching
// the sibling ui/tokens + ui/menus NavSection convention.
const sections = [
	{ id: 'layout', label: 'Layout' },
	{ id: 'elevation', label: 'Surface Elevation' },
];
</script>
<NavSection {sections} />

<main class="content">
	<LayoutSection />
	<ElevationSection />
</main>
