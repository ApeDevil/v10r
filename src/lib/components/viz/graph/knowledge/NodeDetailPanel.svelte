<script lang="ts">
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner, Typography } from '$lib/components/primitives';
import type { KnowledgeEdge, KnowledgeNode } from '$lib/types/knowledge';

interface Props {
	node: KnowledgeNode;
	edges: KnowledgeEdge[];
	expanded: boolean;
	expandLoading: boolean;
	onExpand: (nodeId: string) => void;
	onClose: () => void;
}

let { node, edges, expanded, expandLoading, onExpand, onClose }: Props = $props();

const outgoing = $derived(edges.filter((e) => e.source === node.id));
const incoming = $derived(edges.filter((e) => e.target === node.id));

const properties = $derived(node.properties ? Object.entries(node.properties).filter(([key]) => key !== 'name') : []);
</script>

<div class="detail-panel">
	<div class="detail-header">
		<div class="detail-title">
			<Badge>{node.entityType}</Badge>
			<Typography variant="h6" as="h3">{node.label}</Typography>
		</div>
		<button type="button" class="close-btn" onclick={onClose} aria-label="Close detail panel">
			<span class="i-lucide-x h-4 w-4"></span>
		</button>
	</div>

	<div class="detail-body">
		<Stack gap="4">
			{#if properties.length > 0}
				<div class="prop-section">
					<Typography variant="muted" as="p" class="section-label">Properties</Typography>
					<div class="prop-grid">
						{#each properties as [key, val]}
							<div class="prop-row">
								<span class="prop-key">{key}</span>
								<span class="prop-val">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if outgoing.length > 0}
				<div class="prop-section">
					<Typography variant="muted" as="p" class="section-label">Outgoing ({outgoing.length})</Typography>
					<div class="edge-list">
						{#each outgoing as edge}
							<div class="edge-item">
								<Badge variant="secondary">{edge.relationshipType}</Badge>
								<span class="edge-target">&rarr; {edge.target}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if incoming.length > 0}
				<div class="prop-section">
					<Typography variant="muted" as="p" class="section-label">Incoming ({incoming.length})</Typography>
					<div class="edge-list">
						{#each incoming as edge}
							<div class="edge-item">
								<span class="edge-target">{edge.source} &rarr;</span>
								<Badge variant="secondary">{edge.relationshipType}</Badge>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if !expanded}
				<Button
					variant="outline"
					size="sm"
					onclick={() => onExpand(node.id)}
					disabled={expandLoading}
				>
					{#if expandLoading}
						<Spinner size="xs" class="mr-1" />
					{/if}
					<span class="i-lucide-network h-4 w-4 mr-1"></span>
					Expand neighbors
				</Button>
			{:else}
				<Typography variant="muted" as="p">Neighbors loaded</Typography>
			{/if}
		</Stack>
	</div>
</div>

<style>
	.detail-panel {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-1);
		overflow: hidden;
		max-height: 100%;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
		gap: var(--spacing-3);
	}

	.detail-title {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.detail-title :global(h3) {
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.close-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.close-btn:hover {
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.detail-body {
		padding: var(--spacing-4);
		overflow-y: auto;
		flex: 1;
	}

	.section-label {
		margin: 0 0 var(--spacing-2) 0;
		font-size: var(--text-fluid-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.prop-section {
		display: flex;
		flex-direction: column;
	}

	.prop-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		gap: var(--spacing-3);
	}

	.prop-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.prop-key {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 500;
		flex-shrink: 0;
	}

	.prop-val {
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		font-family: ui-monospace, monospace;
		word-break: break-all;
		text-align: right;
	}

	.edge-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.edge-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
	}

	.edge-target {
		color: var(--color-fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
