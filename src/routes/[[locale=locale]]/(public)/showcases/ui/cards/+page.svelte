<script lang="ts">
import { NavSection } from '#lib/components/composites/index.ts';
import DepthSection from './_sections/DepthSection.svelte';
import LatentActionsSection from './_sections/LatentActionsSection.svelte';
import RulesSection from './_sections/RulesSection.svelte';

const sections = [
	{ id: 'cards-latent-actions', label: 'Latent Actions' },
	{ id: 'cards-depth', label: 'Depth' },
	{ id: 'cards-rules', label: 'Rules' },
];
</script>
<NavSection {sections} />

<main class="content">
	<LatentActionsSection />
	<DepthSection />
	<RulesSection />
</main>
