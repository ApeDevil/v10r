<script lang="ts">
import { Button, Checkbox, Input, Select, Textarea } from '#lib/components/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	type ArchitectureNode,
	NODE_KINDS,
	type NODE_TRAIT_IDS,
	PLACEMENT_LABELS,
	type Placement,
} from '#patterns/architecture-engineering/index.ts';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';
import { humanize } from './humanize.ts';
import PatternLinks from './PatternLinks.svelte';

let { node }: { node: ArchitectureNode } = $props();
const studio = useArchitectureStudio();

const placements = $derived(
	(NODE_KINDS[node.kind].placements as readonly Placement[]).map((value) => ({
		value,
		label: PLACEMENT_LABELS[value],
	})),
);
const zones = $derived(studio.model.zones.map((zone) => ({ value: zone.id, label: `${zone.label} (${zone.kind})` })));

const TRAIT_LABELS: Record<(typeof NODE_TRAIT_IDS)[number], () => string> = {
	holds_secrets: m.studio_trait_holds_secrets,
	cpu_intensive: m.studio_trait_cpu_intensive,
	long_running: m.studio_trait_long_running,
	stateful: m.studio_trait_stateful,
	distinct_runtime: m.studio_trait_distinct_runtime,
};
</script>

<div class="inspector" aria-label={m.studio_design_node_inspector()}>
	<p class="kind">{NODE_KINDS[node.kind].label} · <code>{node.id}</code></p>

	<label for="node-label">{m.studio_design_label()}</label>
	<Input id="node-label" value={node.label} maxlength={120} oninput={(event) => studio.updateNode(node.id, { label: event.currentTarget.value }, 'label')} />

	<label for="node-placement">{m.studio_design_placement()}</label>
	<Select id="node-placement" options={placements} value={node.placement} onchange={(value) => studio.updateNode(node.id, { placement: value as Placement })} />

	<label for="node-zone">{m.studio_design_zone()}</label>
	<Select id="node-zone" options={zones} value={node.zone} onchange={(value) => studio.updateNode(node.id, { zone: value })} />

	<label for="node-responsibilities">{m.studio_design_responsibilities()}</label>
	<Textarea
		id="node-responsibilities"
		value={node.responsibilities.join('\n')}
		rows={3}
		oninput={(event) =>
			studio.updateNode(
				node.id,
				{ responsibilities: event.currentTarget.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 30) },
				'responsibilities',
			)}
	/>
	<p class="hint">{m.studio_design_responsibilities_hint()}</p>

	<fieldset class="traits">
		<legend>{m.studio_design_traits()}</legend>
		{#each NODE_TRAIT_IDS as trait}
			<Checkbox
				label={TRAIT_LABELS[trait]()}
				checked={node.traits[trait]}
				onchange={(event) => studio.updateNode(node.id, { traits: { [trait]: event.currentTarget.checked } })}
			/>
		{/each}
	</fieldset>

	{#if node.decisions.length > 0}
		<p class="hint"><strong>{m.studio_design_decisions()}</strong> {node.decisions.map(humanize).join(', ')}</p>
	{/if}
	<PatternLinks ids={node.patterns} />

	<Button variant="destructive" size="sm" onclick={() => studio.removeSelected()}>
		<span class="i-lucide-trash-2 mr-2" aria-hidden="true"></span>{m.studio_design_remove_node()}
	</Button>
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	label,
	legend {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.kind,
	.hint {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.traits {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-2) var(--spacing-3);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin: 0;
	}
</style>
