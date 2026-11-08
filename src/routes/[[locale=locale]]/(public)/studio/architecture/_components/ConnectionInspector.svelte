<script lang="ts">
import { Button, Input, Select } from '#lib/components/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	type ArchitectureConnection,
	AUTHENTICATION_STATES,
	CONNECTION_MODES,
	FAILURE_HANDLING,
	NODE_KINDS,
	PROTOCOL_LABELS,
	PROTOCOLS,
	type Protocol,
} from '#patterns/architecture-engineering/index.ts';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';
import { humanize } from './humanize.ts';

let { connection }: { connection: ArchitectureConnection } = $props();
const studio = useArchitectureStudio();

const from = $derived(studio.model.nodes.find((node) => node.id === connection.from));
const to = $derived(studio.model.nodes.find((node) => node.id === connection.to));
const accepted = $derived(new Set<Protocol>(to ? (NODE_KINDS[to.kind].accepts as readonly Protocol[]) : []));
const protocols = $derived(
	PROTOCOLS.map((value) => ({
		value,
		label: accepted.has(value)
			? PROTOCOL_LABELS[value]
			: `${PROTOCOL_LABELS[value]} — ${m.studio_design_not_accepted()}`,
	})),
);
const list = (values: readonly string[]) => values.map((value) => ({ value, label: humanize(value) }));
</script>

<div class="inspector" aria-label={m.studio_design_connection_inspector()}>
	<p class="ends">{from?.label ?? connection.from} → {to?.label ?? connection.to}</p>

	<label for="connection-protocol">{m.studio_design_protocol()}</label>
	<Select id="connection-protocol" options={protocols} value={connection.protocol} onchange={(value) => studio.updateConnection(connection.id, { protocol: value as Protocol })} />

	<label for="connection-mode">{m.studio_design_mode()}</label>
	<Select id="connection-mode" options={list(CONNECTION_MODES)} value={connection.mode} onchange={(value) => studio.updateConnection(connection.id, { mode: value as ArchitectureConnection['mode'] })} />

	<label for="connection-flow">{m.studio_design_data_flow()}</label>
	<Input id="connection-flow" value={connection.data_flow} maxlength={2000} oninput={(event) => studio.updateConnection(connection.id, { data_flow: event.currentTarget.value }, 'data_flow')} />

	<label for="connection-auth">{m.studio_design_authenticated()}</label>
	<Select
		id="connection-auth"
		options={list(AUTHENTICATION_STATES)}
		value={connection.authenticated}
		onchange={(value) => studio.updateConnection(connection.id, { authenticated: value as ArchitectureConnection['authenticated'] })}
	/>

	<label for="connection-failure">{m.studio_design_failure_handling()}</label>
	<Select
		id="connection-failure"
		options={list(FAILURE_HANDLING)}
		value={connection.failure_handling}
		onchange={(value) => studio.updateConnection(connection.id, { failure_handling: value as ArchitectureConnection['failure_handling'] })}
	/>

	<Button variant="destructive" size="sm" onclick={() => studio.removeSelected()}>
		<span class="i-lucide-trash-2 mr-2" aria-hidden="true"></span>{m.studio_design_remove_connection()}
	</Button>
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.ends {
		margin: 0;
		font-weight: 600;
	}
</style>
