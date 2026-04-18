<script lang="ts">
import type { LlmwikiTraceState } from './llmwiki-trace.svelte';
import DrillRound from './DrillRound.svelte';
import PageList from './PageList.svelte';

interface Props {
	trace: LlmwikiTraceState;
}

let { trace }: Props = $props();

type Tab = 'pages' | 'drilled' | 'citations';
let active = $state<Tab>('pages');

const drillSteps = $derived(trace.drillSteps);
const drilledChunks = $derived(trace.drilledChunks);
const citations = $derived(trace.citations);
</script>

<div class="panel">
	<div class="tabs" role="tablist">
		<button
			role="tab"
			type="button"
			class="tab"
			aria-selected={active === 'pages'}
			onclick={() => (active = 'pages')}
		>
			Pages
			<span class="count">{trace.pages.length}</span>
		</button>
		<button
			role="tab"
			type="button"
			class="tab"
			aria-selected={active === 'drilled'}
			onclick={() => (active = 'drilled')}
		>
			Drilled
			<span class="count">{drillSteps.length}</span>
		</button>
		<button
			role="tab"
			type="button"
			class="tab"
			aria-selected={active === 'citations'}
			onclick={() => (active = 'citations')}
		>
			Citations
			<span class="count">{citations?.summary.total ?? 0}</span>
		</button>
	</div>

	<div class="body">
		{#if active === 'pages'}
			<PageList {trace} />
		{:else if active === 'drilled'}
			{#if drillSteps.length === 0}
				<p class="empty">The model answered from TLDRs — no drill-down needed.</p>
			{:else}
				<div class="drill-stack">
					{#each drillSteps as step (step.drillOrdinal)}
						<DrillRound {step} {trace} chunks={drilledChunks} />
					{/each}
				</div>
			{/if}
		{:else if active === 'citations'}
			{#if !citations || citations.verdicts.length === 0}
				<p class="empty">No verification yet.</p>
			{:else}
				<ul class="verdict-list">
					{#each citations.verdicts as v (v.chunkId ?? `${v.pageSlug}-none`)}
						<li class="verdict-row" data-status={v.status}>
							<code class="chunk-id">{v.chunkId ?? '(no chunk)'}</code>
							<span class="status-label">{v.status}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.tabs {
		display: flex;
		gap: var(--spacing-1);
		border-bottom: 1px solid var(--color-border);
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: var(--spacing-2) var(--spacing-3);
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		border-bottom: 2px solid transparent;
	}

	.tab[aria-selected='true'] {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.count {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		font-variant-numeric: tabular-nums;
	}

	.body {
		min-height: 80px;
	}

	.empty {
		font-size: 12px;
		color: var(--color-muted);
		margin: 0;
	}

	.drill-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.verdict-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.verdict-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-2);
		border-left: 3px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
		font-size: 11px;
	}

	.verdict-row[data-status='quote'] {
		border-left-color: var(--color-primary);
	}
	.verdict-row[data-status='paraphrase'] {
		border-left-color: var(--color-success-fg, var(--color-accent));
	}
	.verdict-row[data-status='drifted'] {
		border-left-color: var(--color-warning-fg, #c2860a);
	}
	.verdict-row[data-status='uncited'] {
		border-left-color: var(--color-muted);
	}

	.chunk-id {
		font-family: ui-monospace, monospace;
		color: var(--color-fg);
	}

	.status-label {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}
</style>
