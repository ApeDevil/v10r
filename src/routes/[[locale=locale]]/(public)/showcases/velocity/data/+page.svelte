<script lang="ts">
import { Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { VelocityMeasurementId } from '$lib/showcases/velocity/measurement';
import MeasurementCard from '../_components/MeasurementCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

/** Bumped to ask every card to run. Cards fire their own request, concurrently — the
 *  page demonstrating no-waterfall loading would look silly running them in series. */
let runToken = $state(0);

const measurements = $derived<Array<{ id: VelocityMeasurementId; anchor: string; title: string; intro: string }>>([
	{
		id: 'waterfall',
		anchor: 'vel-waterfall',
		title: m.showcase_velocity_section_waterfall(),
		intro: m.showcase_velocity_waterfall_intro({ ms: data.originMs }),
	},
	{
		id: 'cache',
		anchor: 'vel-cache',
		title: m.showcase_velocity_section_cache(),
		intro: m.showcase_velocity_cache_intro({ ms: data.originMs }),
	},
	{
		id: 'swr',
		anchor: 'vel-swr',
		title: m.showcase_velocity_section_swr(),
		intro: m.showcase_velocity_swr_intro({ ms: data.expiryWaitMs }),
	},
	{
		id: 'stampede',
		anchor: 'vel-stampede',
		title: m.showcase_velocity_section_stampede(),
		intro: m.showcase_velocity_stampede_intro({ callers: data.stampedeCallers }),
	},
	{
		id: 'tail',
		anchor: 'vel-tail',
		title: m.showcase_velocity_section_tail(),
		intro: m.showcase_velocity_tail_intro({ ms: data.originMs }),
	},
]);

const sections = $derived(measurements.map((entry) => ({ id: entry.anchor, label: entry.title })));
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_velocity_data_lead()}</p>

	<NavSection {sections} />

	<div class="run-all">
		<Button variant="secondary" size="sm" onclick={() => runToken++}>{m.showcase_velocity_run_all()}</Button>
		<span class="text-muted text-fluid-sm">{m.showcase_velocity_run_all_note()}</span>
	</div>

	{#each measurements as entry (entry.id)}
		<Card id={entry.anchor}>
			{#snippet header()}
				<Typography variant="h2">{entry.title}</Typography>
			{/snippet}
			<MeasurementCard id={entry.id} title={entry.title} intro={entry.intro} {runToken} />
		</Card>
	{/each}

	<p class="text-muted text-fluid-sm">{m.showcase_velocity_data_honesty()}</p>
</Stack>

<style>
.lead {
	max-width: 68ch;
	font-size: var(--text-fluid-lg);
}

.run-all {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--spacing-3);
}
</style>
