<script lang="ts">
	import type { PipelineStepStatus } from '$lib/types/pipeline';

	interface Props {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		status: PipelineStepStatus;
	}

	let { x1, y1, x2, y2, status }: Props = $props();

	const midY = $derived((y1 + y2) / 2);
	const path = $derived(`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
</script>

<path
	d={path}
	fill="none"
	stroke-width="1.5"
	class="edge"
	class:edge-pending={status === 'pending'}
	class:edge-active={status === 'active'}
	class:edge-done={status === 'done'}
	class:edge-error={status === 'error'}
	class:edge-skipped={status === 'skipped'}
/>

<style>
	.edge {
		stroke: var(--color-border);
	}

	.edge-pending {
		stroke: var(--color-border);
		opacity: 0.4;
	}

	.edge-active {
		stroke: var(--color-primary);
		stroke-dasharray: 4 4;
		animation: dash-flow 0.8s linear infinite;
	}

	.edge-done {
		stroke: var(--color-primary);
		opacity: 0.6;
	}

	.edge-error {
		stroke: var(--color-error-fg);
		opacity: 0.6;
	}

	.edge-skipped {
		stroke: var(--color-border);
		opacity: 0.2;
		stroke-dasharray: 2 4;
	}

	@keyframes dash-flow {
		to {
			stroke-dashoffset: -8;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.edge-active {
			animation: none;
		}
	}
</style>
