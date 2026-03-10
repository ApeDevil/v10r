<script lang="ts">
import { NavSection } from '$lib/components/composites';
import TokensSection from '../components/_sections/TokensSection.svelte';

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
	{ id: 'tok-layout', label: 'Layout' },
];
</script>

<svelte:head>
	<title>Theme Tokens - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<TokensSection />
</main>
