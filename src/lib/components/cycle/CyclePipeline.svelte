<!--
  Horizontal SVG pipeline — pill-shaped stage nodes with animated traveling dots.
  Renders a Client | Server boundary band, ghost pending pills, and dims downstream
  stages when an upstream stage errors.
-->
<script lang="ts">
	import type { CycleStageId, CycleStageState } from './types';
	import { STAGE_COLORS } from './types';

	interface Props {
		stages: CycleStageState[];
		selectedStageId?: CycleStageId | null;
		onselect: (id: CycleStageId) => void;
	}

	let { stages, selectedStageId = null, onselect }: Props = $props();

	const PILL_W = 92;
	const PILL_H = 38;
	const PILL_RX = 19;
	const GAP = 22;
	const PADDING = 18;
	const BAND_H = 10;

	const totalW = $derived(stages.length * PILL_W + (stages.length - 1) * GAP + PADDING * 2);
	const viewH = 100;
	const cy = viewH / 2 + BAND_H / 2;

	/** Index of the first errored stage — downstream stages are dimmed. */
	const errorIdx = $derived(stages.findIndex((s) => s.status === 'error'));
	const hasError = $derived(errorIdx !== -1);

	/** Icon paths — simple glyphs sized to a 10px box (centered on 0,0). */
	const iconPaths: Record<CycleStageId, { d: string; stroke?: boolean }> = {
		browser: { d: 'M-5,-3 h10 v7 h-10 z M-5,-1 h10', stroke: true },
		network: { d: 'M-5,0 L3,0 M0,-3 L3,0 L0,3', stroke: true },
		server: { d: 'M-4,-4 L4,-4 L4,4 L-4,4 Z M-4,-1 L4,-1 M-2,-3 L-2,-2' },
		domain: { d: 'M0,-5 L5,0 L0,5 L-5,0 Z' },
		database: { d: 'M-4,-4 h8 v8 h-8 z M-4,0 h8', stroke: true },
		response: { d: 'M5,0 L-3,0 M0,-3 L-3,0 L0,3', stroke: true },
		embed: { d: 'M-4,-2 L0,2 L4,-2 M-4,2 L0,-2 L4,2', stroke: true },
		retrieve: { d: 'M0,-5 a5,5 0 1,0 0.01,0 M2,2 L5,5', stroke: true },
		rank: { d: 'M-4,3 v-3 M0,3 v-5 M4,3 v-7', stroke: true },
		context: { d: 'M-4,-4 h8 M-4,0 h8 M-4,4 h5', stroke: true },
		generate: { d: 'M-3,-4 L3,0 L-3,4 Z' },
	};

	function pillX(i: number): number {
		return PADDING + i * (PILL_W + GAP);
	}

	function isClickable(status: string): boolean {
		return status === 'done' || status === 'error';
	}

	function pillDimmed(i: number, status: string): boolean {
		if (status === 'blocked') return true;
		return hasError && i > errorIdx;
	}

	const clientCount = $derived(stages.filter((s) => s.side === 'client').length);
	const clientEndX = $derived(clientCount > 0 ? pillX(clientCount - 1) + PILL_W + GAP / 2 : 0);

	const stageDescriptions: Record<string, string> = {
		browser: 'client-side form submission or fetch call',
		network: 'HTTP round-trip between browser and server',
		server: 'SvelteKit hooks, validation, auth',
		domain: 'pure business logic, no framework deps',
		database: 'Drizzle insert into showcase.cycle_run',
		response: 'serialization back to the client',
		embed: 'embed query into vector representation',
		retrieve: 'vector + graph search across tiers',
		rank: 'RRF fusion of multi-tier results',
		context: 'assemble final prompt context block',
		generate: 'LLM streaming — first token → final token',
	};

	function stageDescription(id: string): string {
		return stageDescriptions[id] ?? 'cycle stage';
	}
</script>

<svg
	viewBox="0 0 {totalW} {viewH}"
	class="w-full h-auto"
	role="img"
	aria-label="Request lifecycle pipeline"
>
	<!-- Client/Server boundary band -->
	{#if clientCount > 0 && clientCount < stages.length}
		<g class="boundary">
			<rect
				x={PADDING - 8}
				y={BAND_H - 2}
				width={clientEndX - PADDING + 8}
				height={BAND_H}
				rx="3"
				class="boundary-client"
			/>
			<rect
				x={clientEndX}
				y={BAND_H - 2}
				width={totalW - clientEndX - PADDING + 8}
				height={BAND_H}
				rx="3"
				class="boundary-server"
			/>
			<text x={PADDING - 4} y={BAND_H + 5} class="boundary-label" dominant-baseline="middle">
				CLIENT
			</text>
			<text x={clientEndX + 6} y={BAND_H + 5} class="boundary-label" dominant-baseline="middle">
				SERVER
			</text>
		</g>
	{/if}

	<!-- Edges between pills -->
	{#each stages as stage, i (stage.id)}
		{#if i > 0}
			{@const x1 = pillX(i - 1) + PILL_W}
			{@const x2 = pillX(i)}
			{@const prevStatus = stages[i - 1].status}
			{@const isActive = stage.status === 'active'}
			{@const isDimmed = pillDimmed(i, stage.status)}
			<line
				{x1}
				y1={cy}
				{x2}
				y2={cy}
				class="edge"
				class:edge-active={isActive}
				class:edge-done={prevStatus === 'done' && stage.status !== 'pending'}
				class:edge-dimmed={isDimmed || prevStatus === 'pending' || prevStatus === 'blocked'}
			/>
			{#if isActive}
				<circle r="3" class="traveling-dot" cy={cy}>
					<animate
						attributeName="cx"
						from={x1}
						to={x2}
						dur="0.45s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						values="0;1;1;0"
						keyTimes="0;0.2;0.8;1"
						dur="0.45s"
						repeatCount="indefinite"
					/>
				</circle>
			{/if}
		{/if}
	{/each}

	<!-- Stage pills -->
	{#each stages as stage, i (stage.id)}
		{@const x = pillX(i)}
		{@const y = cy - PILL_H / 2}
		{@const clickable = isClickable(stage.status)}
		{@const color = STAGE_COLORS[stage.id]}
		{@const icon = iconPaths[stage.id] ?? iconPaths.server}
		{@const dimmed = pillDimmed(i, stage.status)}
		{@const selected = selectedStageId === stage.id}

		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="pill"
			class:pill-clickable={clickable}
			class:pill-selected={selected}
			class:pill-error-shake={stage.status === 'error'}
			class:pill-dimmed={dimmed}
			onclick={() => clickable && onselect(stage.id)}
			onkeydown={(e) => e.key === 'Enter' && clickable && onselect(stage.id)}
			tabindex={clickable ? 0 : undefined}
			role={clickable ? 'button' : undefined}
			aria-label="{stage.label}: {stage.status}{stage.durationMs
				? ` (${stage.durationMs}ms)`
				: ''}"
		>
			<title>{stage.label} — {stageDescription(stage.id)}</title>

			{#if stage.status === 'active'}
				<rect
					{x}
					{y}
					width={PILL_W}
					height={PILL_H}
					rx={PILL_RX}
					class="sonar"
					style="--stage-color: {color};"
				/>
			{/if}

			<rect
				{x}
				{y}
				width={PILL_W}
				height={PILL_H}
				rx={PILL_RX}
				class="pill-rect"
				class:pill-pending={stage.status === 'pending'}
				class:pill-active={stage.status === 'active'}
				class:pill-done={stage.status === 'done'}
				class:pill-error={stage.status === 'error'}
				class:pill-blocked={stage.status === 'blocked'}
				style="--stage-color: {color};"
			/>

			<path
				d={icon.d}
				transform="translate({x + 18}, {cy})"
				class="pill-icon"
				class:icon-active={stage.status === 'active' ||
					stage.status === 'done' ||
					stage.status === 'error'}
				fill={icon.stroke ? 'none' : 'currentColor'}
				stroke={icon.stroke ? 'currentColor' : 'none'}
				stroke-width={icon.stroke ? 1.5 : 0}
				stroke-linecap="round"
				stroke-linejoin="round"
				style="--stage-color: {color};"
			/>

			<text
				x={x + 34}
				y={cy - 3}
				class="pill-label"
				class:label-dimmed={stage.status === 'pending' || stage.status === 'blocked'}
				dominant-baseline="middle"
			>
				{stage.label}
			</text>

			{#if stage.durationMs != null && (stage.status === 'done' || stage.status === 'error')}
				<text x={x + 34} y={cy + 9} class="pill-duration" dominant-baseline="middle">
					{stage.durationMs}ms
				</text>
			{/if}

			{#if stage.status === 'done'}
				{@const bx = x + PILL_W - 9}
				{@const by = y + 5}
				<circle cx={bx} cy={by} r="5" class="badge-done" />
				<path
					d="M{bx - 3},{by} L{bx - 1},{by + 2.5} L{bx + 3},{by - 2}"
					class="badge-check"
				/>
			{/if}

			{#if stage.status === 'error'}
				{@const bx = x + PILL_W - 9}
				{@const by = y + 5}
				<circle cx={bx} cy={by} r="5" class="badge-error" />
				<path
					d="M{bx - 2},{by - 2} L{bx + 2},{by + 2} M{bx + 2},{by - 2} L{bx - 2},{by + 2}"
					class="badge-x"
				/>
			{/if}

			{#if stage.status === 'error'}
				<text x={x + PILL_W / 2} y={y + PILL_H + 10} class="stopped-label" text-anchor="middle">
					stopped here
				</text>
			{/if}
		</g>
	{/each}
</svg>

<style>
	/* --- Boundary band --- */
	.boundary-client {
		fill: color-mix(in srgb, var(--chart-6) 12%, transparent);
	}

	.boundary-server {
		fill: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.boundary-label {
		font-size: 7.5px;
		fill: var(--color-muted);
		letter-spacing: 0.1em;
		font-weight: 600;
		pointer-events: none;
		text-transform: uppercase;
	}

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
		opacity: 0.25;
	}

	/* --- Pills --- */
	.pill {
		cursor: default;
		outline: none;
		transition: opacity 180ms ease-out;
	}

	.pill-clickable {
		cursor: pointer;
	}

	.pill-clickable:hover .pill-rect,
	.pill-clickable:focus-visible .pill-rect {
		stroke-width: 2.5;
		filter: brightness(1.12);
	}

	.pill-selected .pill-rect {
		stroke-width: 2.5;
		filter: brightness(1.15) saturate(1.2);
	}

	.pill-dimmed {
		opacity: 0.35;
	}

	.pill-rect {
		stroke-width: 1.5;
	}

	.pill-pending {
		fill: color-mix(in srgb, var(--color-border) 8%, transparent);
		stroke: var(--color-border);
	}

	.pill-active {
		fill: color-mix(in srgb, var(--stage-color) 22%, transparent);
		stroke: var(--stage-color);
	}

	.pill-done {
		fill: color-mix(in srgb, var(--stage-color) 14%, transparent);
		stroke: var(--stage-color);
	}

	.pill-error {
		fill: color-mix(in srgb, var(--color-error-fg) 16%, transparent);
		stroke: var(--color-error-fg);
	}

	.pill-blocked {
		fill: color-mix(in srgb, var(--color-border) 5%, transparent);
		stroke: var(--color-border);
		stroke-dasharray: 2 3;
		opacity: 0.45;
	}

	/* --- Icon --- */
	.pill-icon {
		color: var(--color-muted);
	}

	.icon-active {
		color: var(--stage-color);
	}

	.pill-error .pill-icon {
		color: var(--color-error-fg);
	}

	/* --- Labels --- */
	.pill-label {
		font-size: 10px;
		font-weight: 500;
		fill: var(--color-fg);
		pointer-events: none;
	}

	.label-dimmed {
		opacity: 0.45;
	}

	.pill-duration {
		font-size: 8px;
		fill: var(--color-muted);
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.stopped-label {
		font-size: 8.5px;
		fill: var(--color-error-fg);
		font-weight: 500;
		pointer-events: none;
		letter-spacing: 0.02em;
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
		.sonar,
		.pill-error-shake,
		.edge-active {
			animation: none;
		}
		.sonar {
			opacity: 0.25;
		}
		.traveling-dot {
			display: none;
		}
	}
</style>
