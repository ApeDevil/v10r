<script lang="ts">
import type { PipelineChunksEvent } from '$lib/types/pipeline';
import ChunkList from './ChunkList.svelte';

interface Tab {
	id: string;
	label: string;
	count: number;
}

interface Props {
	chunkData: PipelineChunksEvent;
	onclose: () => void;
}

let { chunkData, onclose }: Props = $props();

const tabs = $derived.by(() => {
	const t: Tab[] = [];
	for (const [key, chunks] of Object.entries(chunkData.tierChunks)) {
		const tierNum = key.replace('tier-', 'T');
		t.push({ id: key, label: tierNum, count: chunks.length });
	}
	t.push({ id: 'ranked', label: 'Ranked', count: chunkData.rankedChunks.length });
	t.push({ id: 'context', label: 'Context', count: chunkData.contextChunks.length });
	return t;
});

// svelte-ignore state_referenced_locally
let activeTabId = $state(Object.keys(chunkData.tierChunks)[0] ?? 'ranked');

const activeChunks = $derived.by(() => {
	if (activeTabId.startsWith('tier-')) return chunkData.tierChunks[activeTabId] ?? [];
	if (activeTabId === 'ranked') return chunkData.rankedChunks;
	if (activeTabId === 'context') return chunkData.contextChunks;
	return [];
});

const totalFound = $derived(Object.values(chunkData.tierChunks).reduce((sum, c) => sum + c.length, 0));

const funnelStats = $derived(
	activeTabId === 'ranked' || activeTabId === 'context'
		? { found: totalFound, kept: chunkData.rankedChunks.length, context: chunkData.contextChunks.length }
		: undefined,
);
</script>

<div class="detail-panel" role="region" aria-label="Chunk detail panel">
	<div class="panel-header">
		<div class="tab-bar" role="tablist">
			{#each tabs as tab (tab.id)}
				<button
					class="tab"
					class:tab-active={activeTabId === tab.id}
					role="tab"
					aria-selected={activeTabId === tab.id}
					onclick={() => { activeTabId = tab.id; }}
				>
					{tab.label}
					<span class="tab-count">{tab.count}</span>
				</button>
			{/each}
		</div>
		<button class="panel-close" onclick={onclose} aria-label="Close chunk detail panel">
			<span class="i-lucide-x h-3.5 w-3.5"></span>
		</button>
	</div>

	<div class="panel-body" role="tabpanel">
		<ChunkList chunks={activeChunks} {funnelStats} maxHeight="320px" />
	</div>
</div>

<style>
	.detail-panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--color-surface-2) 90%, transparent);
		animation: panel-enter 200ms ease-out;
	}

	@keyframes panel-enter {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-panel { animation: none; }
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--color-border);
		padding: 0 var(--spacing-2);
	}

	.tab-bar {
		display: flex;
		gap: 0;
		overflow-x: auto;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: var(--spacing-2) var(--spacing-3);
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.tab:hover {
		color: var(--color-fg);
	}

	.tab-active {
		color: var(--color-primary);
		border-bottom-color: var(--color-primary);
	}

	.tab-count {
		font-size: 9px;
		font-weight: 600;
		padding: 1px 4px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.tab-active .tab-count {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.panel-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-muted);
		cursor: pointer;
		flex-shrink: 0;
	}

	.panel-close:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.panel-body {
		padding: var(--spacing-3);
	}
</style>
