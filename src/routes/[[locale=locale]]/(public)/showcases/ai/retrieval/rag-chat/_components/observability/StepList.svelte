<!--
  Step view (live) — vertical stepper: pending (muted) → active (pulse) → done (✓) / error.
  Per-step duration + chunk count fill in on completion. Rows are focusable buttons that
  drive cross-panel selection. Drill steps indent. Teaches sequence + causal dependency.
-->
<script lang="ts">
import type { NragTraceState } from '../trace/nrag-trace.svelte';
import { PHASE_COLORS } from '../trace/step-colors';

interface Props {
	trace: NragTraceState;
}

let { trace }: Props = $props();

function chunkCount(instanceKey: string): number {
	return trace.chunksForStep(instanceKey).length;
}
</script>

<ol class="step-list" aria-label="Retrieval steps">
	{#each trace.steps as step (step.instanceKey)}
		{@const selected = trace.selectedStepId === step.instanceKey}
		{@const count = trace.chunkData ? chunkCount(step.instanceKey) : 0}
		<li class="step step-{step.status}" style="--phase-color: {PHASE_COLORS[step.phase]};">
			<button
				type="button"
				class="step-btn"
				class:selected
				class:indented={step.id === 'rawrag:drill'}
				aria-pressed={selected}
				onclick={() => trace.selectStep(step.instanceKey)}
			>
				<span class="marker" aria-hidden="true">
					{#if step.status === 'active'}
						<span class="i-lucide-loader-2 spin"></span>
					{:else if step.status === 'done'}
						<span class="i-lucide-check"></span>
					{:else if step.status === 'error'}
						<span class="i-lucide-triangle-alert err"></span>
					{:else if step.status === 'skipped'}
						<span class="i-lucide-minus muted"></span>
					{:else}
						<span class="dot"></span>
					{/if}
				</span>

				<span class="step-label">{step.label}</span>

				<span class="step-meta">
					{#if step.status === 'done' || step.status === 'error'}
						{#if count > 0}
							<span class="chunk-count">{count}</span>
						{/if}
						{#if step.durationMs != null}
							<span class="ms">{step.durationMs}ms</span>
						{/if}
					{:else if step.status === 'active'}
						<span class="running">running…</span>
					{/if}
				</span>
			</button>
		</li>
	{/each}
</ol>

<style>
	.step-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.step {
		position: relative;
	}

	.step-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		width: 100%;
		padding: var(--spacing-2);
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--color-fg);
		font-size: 12px;
		border-radius: var(--radius-sm);
	}

	.step-btn.indented {
		padding-left: var(--spacing-5);
	}

	.step-btn:hover {
		background: color-mix(in srgb, var(--phase-color) 8%, transparent);
	}

	.step-btn.selected {
		background: color-mix(in srgb, var(--phase-color) 12%, transparent);
		box-shadow: inset 2px 0 0 var(--phase-color);
	}

	.marker {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		color: var(--phase-color);
		font-size: 13px;
	}

	.step-pending .marker {
		color: var(--color-muted);
	}

	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 2px solid var(--color-border);
	}

	.err {
		color: var(--color-error-fg);
	}

	.muted {
		color: var(--color-muted);
	}

	.step-pending .step-label {
		color: var(--color-muted);
	}

	.step-label {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.step-meta {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-shrink: 0;
		font-size: 11px;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.chunk-count {
		padding: 0 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--phase-color) 15%, transparent);
		color: var(--phase-color);
		font-weight: 600;
	}

	.running {
		color: var(--phase-color);
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.step-active .marker {
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spin,
		.step-active .marker {
			animation: none;
		}
	}
</style>
