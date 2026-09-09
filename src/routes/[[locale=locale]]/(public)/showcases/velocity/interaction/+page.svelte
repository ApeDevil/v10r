<script lang="ts">
import { Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import OptimisticDemo from '../_components/OptimisticDemo.svelte';
import PreloadTable from '../_components/PreloadTable.svelte';
import PreloadTiming from '../_components/PreloadTiming.svelte';
import VirtualDemo from '../_components/VirtualDemo.svelte';

const sections = $derived([
	{ id: 'vel-optimistic', label: m.showcase_velocity_section_optimistic() },
	{ id: 'vel-preload', label: m.showcase_velocity_section_preload() },
	{ id: 'vel-virtual', label: m.showcase_velocity_section_virtual() },
]);
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_velocity_interaction_lead()}</p>

	<NavSection {sections} />

	<Card id="vel-optimistic">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_optimistic()}</Typography>
		{/snippet}
		<Stack gap="4">
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_optimistic_intro()}</p>
			<OptimisticDemo />
		</Stack>
	</Card>

	<Card id="vel-preload">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_preload()}</Typography>
		{/snippet}
		<Stack gap="4">
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_preload_intro()}</p>
			<PreloadTiming />
			<PreloadTable />
		</Stack>
	</Card>

	<Card id="vel-virtual">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_virtual()}</Typography>
		{/snippet}
		<Stack gap="4">
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_virtual_intro()}</p>
			<VirtualDemo />
		</Stack>
	</Card>
</Stack>

<style>
.lead {
	max-width: 68ch;
	font-size: var(--text-fluid-lg);
}
</style>
