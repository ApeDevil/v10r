<script lang="ts">
import type { PipelineStepId, PipelineStepState } from '$lib/types/pipeline';

interface Props {
	step: PipelineStepState;
	x: number;
	y: number;
	hovered?: boolean;
	onselect: (id: PipelineStepId) => void;
	onhover?: (id: PipelineStepId | null) => void;
}

let { step, x, y, hovered = false, onselect, onhover }: Props = $props();

const r = 14;

const clickable = $derived(step.status === 'done' || step.status === 'error');

/** Simplified SVG icon paths per step */
const iconPaths: Record<PipelineStepId, string> = {
	embed: 'M-4,-4 L4,-4 L4,4 L-4,4 Z M-2,-2 L2,-2 L2,2 L-2,2 Z',
	'tier-1': 'M0,-5 L5,3 L-5,3 Z',
	'tier-2': 'M-4,-4 L4,-4 L4,4 L-4,4 Z',
	'tier-3': 'M0,-5 L5,0 L0,5 L-5,0 Z',
	rank: 'M-4,-3 L4,-3 M-3,0 L3,0 M-2,3 L2,3',
	context: 'M-4,-4 L4,-4 L4,4 L-4,4 Z M-2,-2 L2,-2 M-2,0 L2,0 M-2,2 L1,2',
	generate: 'M0,-5 L2,-1 L5,0 L2,1 L0,5 L-2,1 L-5,0 L-2,-1 Z',
};

const isStroke = $derived(step.id === 'rank');
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<g
	class="node"
	class:node-clickable={clickable}
	class:node-hovered={hovered}
	class:node-error-shake={step.status === 'error'}
	transform="translate({x}, {y})"
	onclick={() => clickable && onselect(step.id)}
	onkeydown={(e) => e.key === 'Enter' && clickable && onselect(step.id)}
	onmouseenter={() => onhover?.(step.id)}
	onmouseleave={() => onhover?.(null)}
	onfocus={() => onhover?.(step.id)}
	onblur={() => onhover?.(null)}
	tabindex={clickable ? 0 : undefined}
	role={clickable ? 'button' : undefined}
	aria-label="{step.label}: {step.status}{step.durationMs ? ` (${step.durationMs}ms)` : ''}"
>
	<!-- Sonar pulse for active state -->
	{#if step.status === 'active'}
		<circle class="sonar" cx="0" cy="0" r={r} />
	{/if}

	<!-- Main circle -->
	<circle
		cx="0"
		cy="0"
		r={r}
		class="node-circle"
		class:circle-pending={step.status === 'pending'}
		class:circle-active={step.status === 'active'}
		class:circle-done={step.status === 'done'}
		class:circle-error={step.status === 'error'}
		class:circle-skipped={step.status === 'skipped'}
	/>

	<!-- Icon -->
	<path
		d={iconPaths[step.id]}
		class="node-icon"
		class:icon-active={step.status === 'active' || step.status === 'done'}
		class:icon-skipped={step.status === 'skipped'}
		fill={isStroke ? 'none' : 'currentColor'}
		stroke={isStroke ? 'currentColor' : 'none'}
		stroke-width={isStroke ? 1.5 : 0}
	/>

	<!-- Label -->
	<text x={r + 6} y="1" class="node-label" dominant-baseline="middle">
		{step.label}
	</text>

	<!-- Duration -->
	{#if step.durationMs !== undefined && step.status === 'done'}
		<text x={r + 6} y="13" class="node-duration" dominant-baseline="middle">
			{step.durationMs}ms
		</text>
	{/if}

	<!-- Done badge -->
	{#if step.status === 'done'}
		<circle cx={r * 0.7} cy={-r * 0.7} r="5" class="badge-done" />
		<path d="M{r * 0.7 - 3},{-r * 0.7} L{r * 0.7 - 1},{-r * 0.7 + 2.5} L{r * 0.7 + 3},{-r * 0.7 - 2}" class="badge-check" />
	{/if}

	<!-- Error badge -->
	{#if step.status === 'error'}
		<circle cx={r * 0.7} cy={-r * 0.7} r="5" class="badge-error" />
		<path d="M{r * 0.7 - 2},{-r * 0.7 - 2} L{r * 0.7 + 2},{-r * 0.7 + 2} M{r * 0.7 + 2},{-r * 0.7 - 2} L{r * 0.7 - 2},{-r * 0.7 + 2}" class="badge-x" />
	{/if}
</g>

<style>
	.node {
		cursor: default;
		outline: none;
	}

	.node-clickable {
		cursor: pointer;
	}

	.node-hovered .node-circle {
		stroke-width: 2.5;
		filter: brightness(1.2);
	}

	.node-circle {
		stroke-width: 2;
	}

	.circle-pending {
		fill: color-mix(in srgb, var(--color-border) 15%, transparent);
		stroke: var(--color-border);
	}

	.circle-active {
		fill: color-mix(in srgb, var(--color-primary) 20%, transparent);
		stroke: var(--color-primary);
	}

	.circle-done {
		fill: color-mix(in srgb, var(--color-primary) 15%, transparent);
		stroke: var(--color-primary);
	}

	.circle-error {
		fill: color-mix(in srgb, var(--color-error-fg) 15%, transparent);
		stroke: var(--color-error-fg);
	}

	.circle-skipped {
		fill: color-mix(in srgb, var(--color-border) 8%, transparent);
		stroke: var(--color-border);
		opacity: 0.4;
	}

	.node-icon {
		color: var(--color-muted);
	}

	.icon-active {
		color: var(--color-primary);
	}

	.icon-skipped {
		opacity: 0.3;
	}

	.node-label {
		font-size: 11px;
		fill: var(--color-fg);
	}

	.node-duration {
		font-size: 9px;
		fill: var(--color-muted);
	}

	.sonar {
		fill: none;
		stroke: var(--color-primary);
		stroke-width: 1.5;
		opacity: 0;
		animation: sonar 1.5s ease-out infinite;
	}

	@keyframes sonar {
		0% {
			r: 14;
			opacity: 0.6;
		}
		100% {
			r: 26;
			opacity: 0;
		}
	}

	.badge-done {
		fill: var(--color-primary);
	}

	.badge-check {
		fill: none;
		stroke: var(--color-on-primary-container);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.badge-error {
		fill: var(--color-error-fg);
	}

	.badge-x {
		fill: none;
		stroke: white;
		stroke-width: 1.5;
		stroke-linecap: round;
	}

	.node-error-shake {
		animation: shake 0.4s ease-in-out;
	}

	@keyframes shake {
		0%, 100% { transform: translate(var(--tx, 0), var(--ty, 0)); }
		25% { transform: translate(calc(var(--tx, 0) + 2px), var(--ty, 0)); }
		75% { transform: translate(calc(var(--tx, 0) - 2px), var(--ty, 0)); }
	}

	@media (prefers-reduced-motion: reduce) {
		.sonar {
			animation: none;
			opacity: 0.3;
			r: 20;
		}

		.node-error-shake {
			animation: none;
		}
	}
</style>
