<!--
  Horizontal SVG pipeline — pill-shaped stage nodes with animated traveling dots.
  Status CSS patterns reused from PipelineNode.svelte (color-mix, sonar, shake).
-->
<script lang="ts">
	import type { CycleStageId, CycleStageState } from './types';
	import { STAGE_COLORS } from './types';

	interface Props {
		stages: CycleStageState[];
		onselect: (id: CycleStageId) => void;
	}

	let { stages, onselect }: Props = $props();

	const PILL_W = 92;
	const PILL_H = 36;
	const PILL_RX = 18;
	const GAP = 24;
	const PADDING = 16;
	const TOTAL_W = 6 * PILL_W + 5 * GAP + PADDING * 2;
	const VIEW_H = 80;

	/** Icon paths for each stage (simplified inline SVGs). */
	const iconPaths: Record<CycleStageId, { d: string; stroke?: boolean }> = {
		browser: { d: 'M-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M-5,0 L5,0 M0,-5 L0,5' },
		network: { d: 'M-5,0 L3,0 M0,-3 L3,0 L0,3', stroke: true },
		server: { d: 'M-4,-4 L4,-4 L4,4 L-4,4 Z M-4,-1 L4,-1 M-2,-3 L-2,-2' },
		domain: { d: 'M0,-5 L5,0 L0,5 L-5,0 Z' },
		database: { d: 'M-4,-4 L4,-4 L4,4 L-4,4 Z M-4,0 L4,0' },
		response: { d: 'M5,0 L-3,0 M0,-3 L-3,0 L0,3', stroke: true },
	};

	function pillX(index: number): number {
		return PADDING + index * (PILL_W + GAP);
	}

	function isClickable(status: string): boolean {
		return status === 'done' || status === 'error';
	}
</script>

<svg
	viewBox="0 0 {TOTAL_W} {VIEW_H}"
	class="w-full h-auto"
	role="img"
	aria-label="Request lifecycle pipeline"
>
	<!-- Edges between pills -->
	{#each stages as stage, i}
		{#if i > 0}
			{@const x1 = pillX(i - 1) + PILL_W}
			{@const x2 = pillX(i)}
			{@const y = VIEW_H / 2}
			{@const prevStatus = stages[i - 1].status}
			{@const isActive = stage.status === 'active'}
			<line
				{x1} y1={y} {x2} y2={y}
				class="edge"
				class:edge-active={isActive}
				class:edge-done={prevStatus === 'done' && stage.status !== 'pending'}
				class:edge-dimmed={prevStatus === 'pending' || prevStatus === 'skipped'}
			/>
			<!-- Traveling dot -->
			{#if isActive}
				<circle
					r="3"
					class="traveling-dot"
					style="--edge-x1: {x1}px; --edge-x2: {x2}px; --edge-y: {y}px;"
				>
					<animate
						attributeName="cx"
						from={x1}
						to={x2}
						dur="0.4s"
						fill="freeze"
					/>
					<animate
						attributeName="cy"
						from={y}
						to={y}
						dur="0.4s"
						fill="freeze"
					/>
				</circle>
			{/if}
		{/if}
	{/each}

	<!-- Stage pills -->
	{#each stages as stage, i}
		{@const x = pillX(i)}
		{@const y = VIEW_H / 2 - PILL_H / 2}
		{@const cx = x + PILL_W / 2}
		{@const cy = VIEW_H / 2}
		{@const clickable = isClickable(stage.status)}
		{@const color = STAGE_COLORS[stage.id]}
		{@const icon = iconPaths[stage.id]}

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="pill"
			class:pill-clickable={clickable}
			class:pill-error-shake={stage.status === 'error'}
			onclick={() => clickable && onselect(stage.id)}
			onkeydown={(e) => e.key === 'Enter' && clickable && onselect(stage.id)}
			tabindex={clickable ? 0 : undefined}
			role={clickable ? 'button' : undefined}
			aria-label="{stage.label}: {stage.status}{stage.durationMs ? ` (${stage.durationMs}ms)` : ''}"
		>
			<!-- Sonar pulse for active -->
			{#if stage.status === 'active'}
				<rect
					{x} {y} width={PILL_W} height={PILL_H} rx={PILL_RX}
					class="sonar"
					style="--stage-color: {color};"
				/>
			{/if}

			<!-- Main pill -->
			<rect
				{x} {y} width={PILL_W} height={PILL_H} rx={PILL_RX}
				class="pill-rect"
				class:pill-pending={stage.status === 'pending'}
				class:pill-active={stage.status === 'active'}
				class:pill-done={stage.status === 'done'}
				class:pill-error={stage.status === 'error'}
				class:pill-skipped={stage.status === 'skipped'}
				style="--stage-color: {color};"
			/>

			<!-- Icon -->
			<path
				d={icon.d}
				transform="translate({x + 20}, {cy})"
				class="pill-icon"
				class:icon-active={stage.status === 'active' || stage.status === 'done'}
				class:icon-error={stage.status === 'error'}
				fill={icon.stroke ? 'none' : 'currentColor'}
				stroke={icon.stroke ? 'currentColor' : 'none'}
				stroke-width={icon.stroke ? 1.5 : 0}
				stroke-linecap="round"
				style="--stage-color: {color};"
			/>

			<!-- Label -->
			<text
				x={x + 36} y={cy - 2}
				class="pill-label"
				class:label-dimmed={stage.status === 'pending' || stage.status === 'skipped'}
				dominant-baseline="middle"
			>
				{stage.label}
			</text>

			<!-- Duration -->
			{#if stage.durationMs != null && (stage.status === 'done' || stage.status === 'error')}
				<text
					x={x + 36} y={cy + 10}
					class="pill-duration"
					dominant-baseline="middle"
				>
					{stage.durationMs}ms
				</text>
			{/if}

			<!-- Done badge -->
			{#if stage.status === 'done'}
				{@const bx = x + PILL_W - 8}
				{@const by = y + 4}
				<circle cx={bx} cy={by} r="5" class="badge-done" />
				<path
					d="M{bx - 3},{by} L{bx - 1},{by + 2.5} L{bx + 3},{by - 2}"
					class="badge-check"
				/>
			{/if}

			<!-- Error badge -->
			{#if stage.status === 'error'}
				{@const bx = x + PILL_W - 8}
				{@const by = y + 4}
				<circle cx={bx} cy={by} r="5" class="badge-error" />
				<path
					d="M{bx - 2},{by - 2} L{bx + 2},{by + 2} M{bx + 2},{by - 2} L{bx - 2},{by + 2}"
					class="badge-x"
				/>
			{/if}
		</g>
	{/each}
</svg>

<style>
	/* --- Edges --- */
	.edge {
		stroke: var(--color-border);
		stroke-width: 1.5;
		stroke-dasharray: 4 4;
	}

	.edge-active {
		stroke: var(--color-primary);
		stroke-dasharray: 4 4;
		animation: dash-flow 0.6s linear infinite;
	}

	.edge-done {
		stroke: var(--color-primary);
		stroke-dasharray: none;
		opacity: 0.6;
	}

	.edge-dimmed {
		opacity: 0.3;
	}

	/* --- Pills --- */
	.pill {
		cursor: default;
		outline: none;
	}

	.pill-clickable {
		cursor: pointer;
	}

	.pill-clickable:hover .pill-rect,
	.pill-clickable:focus-visible .pill-rect {
		stroke-width: 2.5;
		filter: brightness(1.15);
	}

	.pill-rect {
		stroke-width: 1.5;
	}

	.pill-pending {
		fill: color-mix(in srgb, var(--color-border) 10%, transparent);
		stroke: var(--color-border);
	}

	.pill-active {
		fill: color-mix(in srgb, var(--stage-color) 20%, transparent);
		stroke: var(--stage-color);
	}

	.pill-done {
		fill: color-mix(in srgb, var(--stage-color) 12%, transparent);
		stroke: var(--stage-color);
		opacity: 0.85;
	}

	.pill-error {
		fill: color-mix(in srgb, var(--color-error-fg) 15%, transparent);
		stroke: var(--color-error-fg);
	}

	.pill-skipped {
		fill: color-mix(in srgb, var(--color-border) 5%, transparent);
		stroke: var(--color-border);
		opacity: 0.35;
	}

	/* --- Icon --- */
	.pill-icon {
		color: var(--color-muted);
	}

	.icon-active {
		color: var(--stage-color);
	}

	.icon-error {
		color: var(--color-error-fg);
	}

	/* --- Labels --- */
	.pill-label {
		font-size: 9px;
		fill: var(--color-fg);
		pointer-events: none;
	}

	.label-dimmed {
		opacity: 0.4;
	}

	.pill-duration {
		font-size: 7.5px;
		fill: var(--color-muted);
		pointer-events: none;
	}

	/* --- Sonar pulse --- */
	.sonar {
		fill: none;
		stroke: var(--stage-color);
		stroke-width: 1.5;
		opacity: 0;
		animation: sonar-pill 1.5s ease-out infinite;
	}

	@keyframes sonar-pill {
		0% {
			stroke-width: 1.5;
			opacity: 0.5;
		}
		100% {
			stroke-width: 6;
			opacity: 0;
		}
	}

	/* --- Badges --- */
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

	/* --- Traveling dot --- */
	.traveling-dot {
		fill: var(--color-primary);
	}

	/* --- Shake animation --- */
	.pill-error-shake {
		animation: shake 0.4s ease-in-out;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(2px);
		}
		75% {
			transform: translateX(-2px);
		}
	}

	/* --- Dash flow --- */
	@keyframes dash-flow {
		to {
			stroke-dashoffset: -8;
		}
	}

	/* --- Reduced motion --- */
	@media (prefers-reduced-motion: reduce) {
		.sonar {
			animation: none;
			opacity: 0.25;
		}

		.pill-error-shake {
			animation: none;
		}

		.edge-active {
			animation: none;
		}

		.traveling-dot {
			display: none;
		}
	}
</style>
