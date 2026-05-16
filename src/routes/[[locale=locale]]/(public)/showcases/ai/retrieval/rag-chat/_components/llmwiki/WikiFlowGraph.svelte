<script lang="ts">
import type { PipelineStepState } from '$lib/types/pipeline';
import type { LlmwikiTraceState } from './llmwiki-trace.svelte';

interface Props {
	trace: LlmwikiTraceState;
	onselect?: (stepId: string) => void;
}

let { trace, onselect }: Props = $props();

const steps = $derived(trace.steps);

function statusClass(step: PipelineStepState): string {
	return `step-${step.status}`;
}
</script>

<ol class="flow" aria-label="llmwiki retrieval steps">
	{#each steps as step, i (i)}
		<li class="step {statusClass(step)}">
			<button
				type="button"
				class="node"
				onclick={() => onselect?.(step.id)}
				aria-label="{step.label}: {step.status}"
			>
				<span class="dot" aria-hidden="true"></span>
				<span class="label">{step.label}</span>
				{#if step.durationMs}
					<span class="ms">{step.durationMs}ms</span>
				{/if}
				{#if step.status === 'active'}
					<span class="i-lucide-loader-2 h-3 w-3 spin" aria-hidden="true"></span>
				{:else if step.status === 'error'}
					<span class="i-lucide-alert-triangle h-3 w-3 err" aria-hidden="true"></span>
				{/if}
			</button>
		</li>
	{/each}
</ol>

<style>
	.flow {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.step {
		position: relative;
		padding-left: var(--spacing-5);
	}

	.step::before {
		content: '';
		position: absolute;
		left: 9px;
		top: 22px;
		bottom: -8px;
		width: 1px;
		background: var(--color-border);
	}

	.step:last-child::before {
		display: none;
	}

	.node {
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

	.node:hover {
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.dot {
		position: absolute;
		left: 4px;
		top: 10px;
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-surface-2, var(--color-surface-1));
		border: 2px solid var(--color-border);
	}

	.step-active .dot {
		border-color: var(--color-primary);
		background: var(--color-primary);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.step-done .dot {
		border-color: var(--color-primary);
		background: var(--color-primary);
	}

	.step-error .dot {
		border-color: var(--color-error-fg);
		background: var(--color-error-fg);
	}

	.step-skipped .dot {
		opacity: 0.4;
	}

	.label {
		font-weight: 500;
	}

	.ms {
		margin-left: auto;
		font-size: 11px;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.spin {
		animation: spin 1s linear infinite;
		color: var(--color-primary);
	}

	.err {
		color: var(--color-error-fg);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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
</style>
