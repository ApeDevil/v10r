<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	title: string;
	description?: string;
	visualization: Snippet;
	dataTable?: Snippet;
	code?: Snippet;
	class?: string;
}

let { title, description, visualization, dataTable, code, class: className }: Props = $props();

let activeTab: 'chart' | 'data' | 'code' = $state('chart');

// Sanitize title for use as HTML id
const idSlug = $derived(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

const availableTabs = $derived(
	['chart', dataTable ? 'data' : null, code ? 'code' : null].filter(Boolean) as Array<'chart' | 'data' | 'code'>,
);

function handleKeydown(event: KeyboardEvent) {
	const currentIndex = availableTabs.indexOf(activeTab);
	if (event.key === 'ArrowRight') {
		event.preventDefault();
		activeTab = availableTabs[(currentIndex + 1) % availableTabs.length];
		(event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`#tab-${activeTab}-${idSlug}`)?.focus();
	} else if (event.key === 'ArrowLeft') {
		event.preventDefault();
		activeTab = availableTabs[currentIndex === 0 ? availableTabs.length - 1 : currentIndex - 1];
		(event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(`#tab-${activeTab}-${idSlug}`)?.focus();
	}
}
</script>

<div class={cn('viz-demo-card', className)}>
	<div class="viz-header">
		<div>
			<h3 class="viz-title">{title}</h3>
			{#if description}
				<p class="viz-description">{description}</p>
			{/if}
		</div>
	</div>

	<div class="viz-tabs" role="tablist" aria-label="View options" tabindex="0" onkeydown={handleKeydown}>
		<button
			role="tab"
			id="tab-chart-{idSlug}"
			aria-selected={activeTab === 'chart'}
			aria-controls="panel-chart-{idSlug}"
			tabindex={activeTab === 'chart' ? 0 : -1}
			class="viz-tab"
			class:active={activeTab === 'chart'}
			onclick={() => (activeTab = 'chart')}
		>
			<span class="i-lucide-bar-chart-3 text-icon-sm"></span>
			Chart
		</button>
		{#if dataTable}
			<button
				role="tab"
				id="tab-data-{idSlug}"
				aria-selected={activeTab === 'data'}
				aria-controls="panel-data-{idSlug}"
				tabindex={activeTab === 'data' ? 0 : -1}
				class="viz-tab"
				class:active={activeTab === 'data'}
				onclick={() => (activeTab = 'data')}
			>
				<span class="i-lucide-table text-icon-sm"></span>
				Data
			</button>
		{/if}
		{#if code}
			<button
				role="tab"
				id="tab-code-{idSlug}"
				aria-selected={activeTab === 'code'}
				aria-controls="panel-code-{idSlug}"
				tabindex={activeTab === 'code' ? 0 : -1}
				class="viz-tab"
				class:active={activeTab === 'code'}
				onclick={() => (activeTab = 'code')}
			>
				<span class="i-lucide-code text-icon-sm"></span>
				Code
			</button>
		{/if}
	</div>

	{#if activeTab === 'chart'}
		<div class="viz-content" role="tabpanel" id="panel-chart-{idSlug}" aria-labelledby="tab-chart-{idSlug}">
			<div class="viz-chart">
				{@render visualization()}
			</div>
		</div>
	{:else if activeTab === 'data' && dataTable}
		<div class="viz-content" role="tabpanel" id="panel-data-{idSlug}" aria-labelledby="tab-data-{idSlug}">
			<div class="viz-data">
				{@render dataTable()}
			</div>
		</div>
	{:else if activeTab === 'code' && code}
		<div class="viz-content" role="tabpanel" id="panel-code-{idSlug}" aria-labelledby="tab-code-{idSlug}">
			<div class="viz-code">
				{@render code()}
			</div>
		</div>
	{/if}
</div>

<style>
	.viz-demo-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		overflow: hidden;
	}

	.viz-header {
		padding: var(--spacing-4) var(--spacing-6);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.viz-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.viz-description {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.viz-tabs {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.viz-tab {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-5);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		border-bottom: 2px solid transparent;
		transition: color var(--duration-fast), border-color var(--duration-fast);
	}

	.viz-tab:hover {
		color: var(--color-fg);
	}

	.viz-tab.active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.viz-tab:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		border-radius: var(--radius-sm);
	}

	.viz-content {
		padding: var(--spacing-6);
		min-height: 12rem;
	}

	.viz-chart {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.viz-data {
		width: 100%;
		overflow-x: auto;
	}

	.viz-code {
		width: 100%;
		overflow-x: auto;
	}

	.viz-code :global(pre) {
		margin: 0;
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		font-family: 'Fira Code', 'Courier New', monospace;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-fg);
	}
</style>
