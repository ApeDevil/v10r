<script lang="ts">
import { Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { VelocityMeasurementId } from '$lib/showcases/velocity/measurement';
import MeasurementCard from '../_components/MeasurementCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

/** Bumped to ask every card to run — concurrently, as on the Data tab. */
let runToken = $state(0);

const measurements = $derived<Array<{ id: VelocityMeasurementId; anchor: string; title: string; intro: string }>>([
	{
		id: 'breaker',
		anchor: 'vel-breaker',
		title: m.showcase_velocity_section_breaker(),
		intro: m.showcase_velocity_breaker_intro({ callers: data.breakerCallers, ms: data.failingMs }),
	},
	{
		id: 'bulkhead',
		anchor: 'vel-bulkhead',
		title: m.showcase_velocity_section_bulkhead(),
		intro: m.showcase_velocity_bulkhead_intro({
			callers: data.slowCallers,
			ms: data.slowMs,
			slots: data.poolSize,
		}),
	},
	{
		id: 'deadline',
		anchor: 'vel-deadline',
		title: m.showcase_velocity_section_deadline(),
		intro: m.showcase_velocity_deadline_intro({
			steps: data.chainSteps,
			ms: data.stepTimeoutMs,
			budget: data.runBudgetMs,
		}),
	},
]);

const sections = $derived(measurements.map((entry) => ({ id: entry.anchor, label: entry.title })));
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_velocity_runtime_lead()}</p>

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

	<p class="text-muted text-fluid-sm">{m.showcase_velocity_runtime_honesty()}</p>
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
