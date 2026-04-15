<script lang="ts">
import type { ExplorerState } from './explorer-state.svelte';

interface Props {
	explorerState: ExplorerState;
}

let { explorerState }: Props = $props();

let selected = $derived(explorerState.selectedId ? explorerState.getNode(explorerState.selectedId) : null);
let path = $derived(selected ? explorerState.getBreadcrumbPath(selected.id) : []);

// Hide below depth 2 — a single-segment breadcrumb wastes vertical space.
let visible = $derived(path.length >= 1 && selected !== null);
</script>

{#if visible && selected}
	<nav class="breadcrumb" aria-label="Location">
		{#each path as crumb (crumb.id)}
			<button
				type="button"
				class="crumb"
				onclick={() => {
					explorerState.selectedId = crumb.id;
				}}
			>
				{crumb.label}
			</button>
			<span class="sep" aria-hidden="true">/</span>
		{/each}
		<span class="crumb crumb-current">{selected.label}</span>
	</nav>
{/if}

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 4px;
		padding: 4px 10px;
		font-size: 11px;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1, var(--color-bg));
		overflow: hidden;
	}

	.crumb {
		padding: 2px 4px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 11px;
		border-radius: var(--radius-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.crumb:hover {
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
		color: var(--color-fg);
	}

	.crumb-current {
		color: var(--color-fg);
		font-weight: 500;
		cursor: default;
	}

	.crumb-current:hover {
		background: transparent;
	}

	.sep {
		flex-shrink: 0;
		color: var(--color-muted);
	}
</style>
