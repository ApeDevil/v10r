<!--
  Detail panel — slides in when a pipeline stage is selected.
  Shows Payload, Timing, and Code Path tabs.
-->
<script lang="ts">
	import { Button } from '$lib/components/primitives';
	import type { CycleStageState, CycleTrace } from './types';

	interface Props {
		stage: CycleStageState;
		trace: CycleTrace;
		totalDurationMs: number;
		onclose: () => void;
	}

	let { stage, trace, totalDurationMs, onclose }: Props = $props();

	let activeTab = $state<'payload' | 'timing' | 'code'>('payload');

	/** Code paths for each stage — shows where this stage runs in the codebase. */
	const codePaths: Record<string, string> = {
		browser: 'Client → form.submit() / fetch()',
		network: 'HTTP POST → SvelteKit adapter → hooks.server.ts',
		server: '$lib/server/cycle/handlers.ts → executeCycle() [validation]',
		domain: '$lib/server/cycle/handlers.ts → executeCycle() [business logic]',
		database: '$lib/server/db → db.insert(cycleRun).values(...).returning()',
		response: '$lib/server/cycle/handlers.ts → executeCycle() [serialization]',
	};

	const pct = $derived(
		totalDurationMs > 0 && stage.durationMs != null
			? Math.round((stage.durationMs / totalDurationMs) * 100)
			: 0,
	);
</script>

<div class="detail-panel">
	<div class="detail-header">
		<div class="detail-title">
			<span class="stage-name">{stage.label}</span>
			{#if stage.durationMs != null}
				<span class="stage-duration">{stage.durationMs}ms</span>
			{/if}
			{#if stage.status === 'error'}
				<span class="stage-error-badge">Error</span>
			{/if}
		</div>
		<Button variant="ghost" size="sm" onclick={onclose} aria-label="Close detail panel">
			&times;
		</Button>
	</div>

	<!-- Tab bar -->
	<div class="tab-bar">
		<button
			class="tab" class:tab-active={activeTab === 'payload'}
			onclick={() => (activeTab = 'payload')}
		>Payload</button>
		<button
			class="tab" class:tab-active={activeTab === 'timing'}
			onclick={() => (activeTab = 'timing')}
		>Timing</button>
		<button
			class="tab" class:tab-active={activeTab === 'code'}
			onclick={() => (activeTab = 'code')}
		>Code Path</button>
	</div>

	<!-- Tab content -->
	<div class="tab-content">
		{#if activeTab === 'payload'}
			{#if stage.detail}
				<pre class="json-display"><code>{JSON.stringify(stage.detail, null, 2)}</code></pre>
			{:else if stage.error}
				<div class="error-message">{stage.error}</div>
			{:else}
				<p class="empty-text">No payload data for this stage.</p>
			{/if}
		{:else if activeTab === 'timing'}
			<div class="timing-grid">
				<div class="timing-row">
					<span class="timing-label">Start offset</span>
					<span class="timing-value">{stage.startOffset ?? 0}ms</span>
				</div>
				<div class="timing-row">
					<span class="timing-label">Duration</span>
					<span class="timing-value">{stage.durationMs ?? '—'}ms</span>
				</div>
				<div class="timing-row">
					<span class="timing-label">% of total</span>
					<span class="timing-value">{pct}%</span>
				</div>
				<div class="timing-row">
					<span class="timing-label">Status</span>
					<span class="timing-value status-{stage.status}">{stage.status}</span>
				</div>
			</div>
		{:else}
			<code class="code-path">{codePaths[stage.id] ?? 'Unknown stage'}</code>
		{/if}
	</div>
</div>

<style>
	.detail-panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
		overflow: hidden;
		animation: slide-in 0.2s ease-out;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
	}

	.detail-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stage-name {
		font-weight: 600;
		font-size: 13px;
	}

	.stage-duration {
		font-size: 12px;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.stage-error-badge {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error-fg) 15%, transparent);
		color: var(--color-error-fg);
		font-weight: 500;
	}

	.tab-bar {
		display: flex;
		border-bottom: 1px solid var(--color-border);
	}

	.tab {
		padding: 0.375rem 0.75rem;
		font-size: 11px;
		color: var(--color-muted);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
	}

	.tab:hover {
		color: var(--color-fg);
	}

	.tab-active {
		color: var(--color-fg);
		border-bottom-color: var(--color-primary);
	}

	.tab-content {
		padding: 0.75rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.json-display {
		font-size: 11px;
		line-height: 1.5;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.error-message {
		font-size: 12px;
		color: var(--color-error-fg);
		padding: 0.5rem;
		background: color-mix(in srgb, var(--color-error-fg) 8%, transparent);
		border-radius: var(--radius-sm);
	}

	.empty-text {
		font-size: 12px;
		color: var(--color-muted);
		margin: 0;
	}

	.timing-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem 1rem;
	}

	.timing-row {
		display: contents;
	}

	.timing-label {
		font-size: 11px;
		color: var(--color-muted);
	}

	.timing-value {
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.status-done {
		color: var(--color-success);
	}

	.status-error {
		color: var(--color-error-fg);
	}

	.code-path {
		display: block;
		font-size: 11px;
		line-height: 1.6;
		color: var(--color-muted);
		word-break: break-all;
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.detail-panel {
			animation: none;
		}
	}
</style>
