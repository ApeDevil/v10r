<script lang="ts">
import { Badge, Button, Input, Select, Textarea } from '#lib/components/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { NODE_KIND_IDS, NODE_KINDS, type NodeKind, PROTOCOL_LABELS } from '#patterns/architecture-engineering/index.ts';
import ArchitectureCanvas from '../_components/ArchitectureCanvas.svelte';
import ConnectionInspector from '../_components/ConnectionInspector.svelte';
import DraftsPanel from '../_components/DraftsPanel.svelte';
import NodeInspector from '../_components/NodeInspector.svelte';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';

const studio = useArchitectureStudio();

let kindToAdd = $state<NodeKind>('app-server');
let connectFrom = $state('');
let connectTo = $state('');

const kindOptions = NODE_KIND_IDS.map((kind) => ({ value: kind, label: NODE_KINDS[kind].label }));
const nodeOptions = $derived(studio.model.nodes.map((node) => ({ value: node.id, label: node.label })));

const selectedNode = $derived(
	studio.selection?.type === 'node' ? studio.model.nodes.find((node) => node.id === studio.selection?.id) : undefined,
);
const selectedConnection = $derived(
	studio.selection?.type === 'connection'
		? studio.model.connections.find((connection) => connection.id === studio.selection?.id)
		: undefined,
);

const REFUSALS: Record<string, () => string> = {
	'connection.self': m.studio_refusal_connection_self,
	'connection.duplicate': m.studio_refusal_connection_duplicate,
	'placement.not-allowed': m.studio_refusal_placement,
	'zone.in-use': m.studio_refusal_zone_in_use,
	'limit.reached': m.studio_refusal_limit,
};

function connect() {
	if (connectFrom && connectTo) studio.connect(connectFrom, connectTo);
}

function onKeydown(event: KeyboardEvent) {
	const target = event.target as HTMLElement;
	if (target.closest('input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"]')) return;
	const mod = event.metaKey || event.ctrlKey;
	if (mod && event.key.toLowerCase() === 'z') {
		event.preventDefault();
		if (event.shiftKey) studio.redo();
		else studio.undo();
	} else if (mod && event.key.toLowerCase() === 'y') {
		event.preventDefault();
		studio.redo();
	} else if ((event.key === 'Delete' || event.key === 'Backspace') && studio.selection) {
		event.preventDefault();
		studio.removeSelected();
	}
}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="design">
	<div class="toolbar" role="toolbar" aria-label={m.studio_design_toolbar_aria()}>
		<div class="add">
			<Select options={kindOptions} bind:value={kindToAdd} aria-label={m.studio_design_component_type()} />
			<Button size="sm" variant="primary" onclick={() => studio.addNode(kindToAdd)}>
				<span class="i-lucide-plus mr-2" aria-hidden="true"></span>{m.studio_design_add_component()}
			</Button>
		</div>
		<Button size="sm" variant="outline" disabled={!studio.canUndo} onclick={() => studio.undo()} aria-keyshortcuts="Control+Z">
			<span class="i-lucide-undo-2 mr-2" aria-hidden="true"></span>{m.studio_design_undo()}
		</Button>
		<Button size="sm" variant="outline" disabled={!studio.canRedo} onclick={() => studio.redo()} aria-keyshortcuts="Control+Shift+Z">
			<span class="i-lucide-redo-2 mr-2" aria-hidden="true"></span>{m.studio_design_redo()}
		</Button>
		<Button size="sm" variant="outline" onclick={() => studio.autoLayout()}>
			<span class="i-lucide-layout-grid mr-2" aria-hidden="true"></span>{m.studio_design_auto_layout()}
		</Button>
	</div>

	{#if studio.refusal}
		<p class="refusal" role="status">{(REFUSALS[studio.refusal] ?? m.studio_refusal_generic)()}</p>
	{/if}

	<div class="workspace">
		<div class="stage">
			<div class="model-info">
				<label for="model-name">{m.studio_design_name()}</label>
				<Input id="model-name" value={studio.model.name} maxlength={120} oninput={(event) => studio.updateInfo({ name: event.currentTarget.value }, 'name')} />
				<label for="model-description">{m.studio_design_description()}</label>
				<Textarea id="model-description" rows={2} value={studio.model.description} oninput={(event) => studio.updateInfo({ description: event.currentTarget.value }, 'description')} />
				{#if studio.model.derived_from}
					<p class="hint">
						<Badge variant="secondary">{m.studio_design_variant_of({ id: studio.model.derived_from })}</Badge>
						{studio.model.change_reason}
					</p>
				{/if}
			</div>

			{#if studio.model.nodes.length === 0}
				<div class="empty">
					<p>{m.studio_design_empty()}</p>
					<Button size="sm" variant="outline" href={localizeHref('/studio/architecture/explore')}>{m.studio_design_empty_explore()}</Button>
				</div>
			{:else}
				<ArchitectureCanvas
					model={studio.model}
					layout={studio.layout}
					findings={studio.findings}
					selectedId={studio.selection?.type === 'node' ? studio.selection.id : null}
					onselect={(id) => studio.select(id ? { type: 'node', id } : null)}
					onconnect={(from, to) => studio.connect(from, to)}
					onmove={(id, position) => studio.moveNode(id, position)}
				/>
			{/if}

			<div class="lists">
				<section aria-labelledby="components-title">
					<h3 id="components-title">{m.studio_design_components({ count: String(studio.model.nodes.length) })}</h3>
					<ul class="items">
						{#each studio.model.nodes as node (node.id)}
							<li>
								<Button
									size="sm"
									variant={studio.selection?.type === 'node' && studio.selection.id === node.id ? 'primary' : 'ghost'}
									aria-pressed={studio.selection?.type === 'node' && studio.selection.id === node.id}
									onclick={() => studio.select({ type: 'node', id: node.id })}
								>
									{node.label}
								</Button>
								<span class="hint">{NODE_KINDS[node.kind].label}</span>
							</li>
						{/each}
					</ul>
				</section>
				<section aria-labelledby="connections-title">
					<h3 id="connections-title">{m.studio_design_connections({ count: String(studio.model.connections.length) })}</h3>
					<div class="connect">
						<Select options={nodeOptions} bind:value={connectFrom} placeholder={m.studio_design_from()} aria-label={m.studio_design_from()} />
						<Select options={nodeOptions} bind:value={connectTo} placeholder={m.studio_design_to()} aria-label={m.studio_design_to()} />
						<Button size="sm" variant="outline" disabled={!connectFrom || !connectTo} onclick={connect}>
							<span class="i-lucide-link-2 mr-2" aria-hidden="true"></span>{m.studio_design_connect()}
						</Button>
					</div>
					<ul class="items">
						{#each studio.model.connections as connection (connection.id)}
							<li>
								<Button
									size="sm"
									variant={studio.selection?.type === 'connection' && studio.selection.id === connection.id ? 'primary' : 'ghost'}
									aria-pressed={studio.selection?.type === 'connection' && studio.selection.id === connection.id}
									onclick={() => studio.select({ type: 'connection', id: connection.id })}
								>
									{connection.from} → {connection.to}
								</Button>
								<span class="hint">{PROTOCOL_LABELS[connection.protocol]}</span>
							</li>
						{/each}
					</ul>
				</section>
			</div>
		</div>

		<aside class="side">
			<section class="panel" aria-labelledby="inspector-title">
				<h3 id="inspector-title">{m.studio_design_inspector()}</h3>
				{#if selectedNode}
					{#key selectedNode.id}
						<NodeInspector node={selectedNode} />
					{/key}
				{:else if selectedConnection}
					{#key selectedConnection.id}
						<ConnectionInspector connection={selectedConnection} />
					{/key}
				{:else}
					<p class="hint">{m.studio_design_inspector_empty()}</p>
				{/if}
			</section>
			<DraftsPanel />
		</aside>
	</div>
</div>

<style>
	.design {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		align-items: center;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		align-items: center;
		min-width: min(100%, 22rem);
	}

	.toolbar :global(button) {
		white-space: nowrap;
	}

	.refusal {
		margin: 0;
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-5);
	}

	@media (min-width: 64rem) {
		.workspace {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
	}

	.stage,
	.side {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		min-width: 0;
	}

	.model-info {
		display: grid;
		gap: var(--spacing-2);
	}

	label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	h3 {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.hint {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.empty {
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-3);
	}

	.empty p {
		margin: 0;
	}

	.lists {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: var(--spacing-4);
	}

	.lists section,
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		background: var(--surface-1);
	}

	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.items li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.connect {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: var(--spacing-2);
		align-items: center;
	}

	@media (max-width: 30rem) {
		.connect {
			grid-template-columns: 1fr;
		}
	}
</style>
