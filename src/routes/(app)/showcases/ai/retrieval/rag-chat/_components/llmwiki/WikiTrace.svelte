<script lang="ts">
import type { LlmwikiTraceState } from './llmwiki-trace.svelte';
import WikiDetailPanel from './WikiDetailPanel.svelte';
import WikiFlowGraph from './WikiFlowGraph.svelte';

interface Props {
	trace: LlmwikiTraceState;
}

let { trace }: Props = $props();

const statusLabel = $derived.by(() => {
	if (trace.isActive) return 'Running';
	if (trace.totalDurationMs > 0) return `${trace.totalDurationMs}ms`;
	return 'Idle';
});
</script>

<div class="wiki-trace">
	<div class="header">
		<span class="title">Retrieval Trace · llmwiki</span>
		<span
			class="status"
			class:active={trace.isActive}
			class:done={!trace.isActive && trace.totalDurationMs > 0}
		>
			{#if trace.isActive}
				<span class="dot" aria-hidden="true"></span>
			{/if}
			{statusLabel}
		</span>
	</div>

	<div class="grid">
		<div class="graph-col">
			<WikiFlowGraph {trace} />
		</div>
		<div class="detail-col">
			<WikiDetailPanel {trace} />
		</div>
	</div>
</div>

<style>
	.wiki-trace {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.status {
		font-size: 11px;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.status.active {
		color: var(--color-primary);
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: pulse-dot 1s ease-in-out infinite;
	}

	.grid {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: var(--spacing-4);
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
