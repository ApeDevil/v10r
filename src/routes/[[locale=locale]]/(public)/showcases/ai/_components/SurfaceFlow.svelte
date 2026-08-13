<script lang="ts">
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { BUILD_LABELS, LANE_LABELS, LAYER_NAMES, layerRole, STATUS_LABELS } from '$lib/showcase/ai/labels';
import { AI_LAYERS, type AiLayer, STEP_BUDGETS } from '$lib/showcase/ai/topology';
import type { AiSurfaceId } from '$lib/types/ai-tools';
import type { AiLayerId, TraceStatus, TurnTrace } from '$lib/types/turn-trace';

let { surface, trace = null }: { surface: AiSurfaceId; trace?: TurnTrace | null } = $props();

const layers = AI_LAYERS.filter((l) => l.surfaces.includes(surface));

// Grammar: vertical = happens-after; lanes-in-row = concurrent; bracket = bounded loop.
// The stack is one tab stop (roving tabindex over the row summaries); Enter/Space
// toggles the native <details> inspector, so all content is SSR'd and zero-JS readable.
let summaryEls: (HTMLElement | undefined)[] = $state([]);
let focusIndex = $state(0);

function onSummaryKeydown(event: KeyboardEvent, index: number) {
	let next = index;
	if (event.key === 'ArrowDown') next = Math.min(index + 1, layers.length - 1);
	else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = layers.length - 1;
	else return;
	event.preventDefault();
	focusIndex = next;
	summaryEls[next]?.focus();
}

function statusOf(id: AiLayerId): TraceStatus | undefined {
	return trace?.layers[id];
}

const STATUS_ICON: Record<TraceStatus, string> = {
	pending: 'i-lucide-circle',
	active: 'i-lucide-circle-dot',
	done: 'i-lucide-circle-check',
	skipped: 'i-lucide-circle-dashed',
	'not-taken': 'i-lucide-circle-slash',
	error: 'i-lucide-triangle-alert',
};

function sourceOf(layer: AiLayer): string {
	return layer.sourceBySurface?.[surface] ?? layer.source;
}

function loopCap(): string {
	return surface === 'chatbot'
		? `stepCountIs(${STEP_BUDGETS.chatbot})`
		: `stepCountIs(${STEP_BUDGETS.deskRead} · ${STEP_BUDGETS.deskMutate})`;
}

const halted = $derived(trace?.outcome?.kind === 'awaiting_decision');
</script>

<!-- The "request is here now" particle: SMIL dots riding the rail segment of the
     active row. Pure function of trace status — survives seek/scrub for free. -->
{#snippet railPulse()}
	<svg class="rail-pulse" aria-hidden="true">
		<circle class="pulse-dot" cx="50%" cy="0%" r="3" opacity="0">
			<animate attributeName="cy" from="0%" to="100%" dur="1.6s" repeatCount="indefinite" />
			<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.6s" repeatCount="indefinite" />
		</circle>
		<circle class="pulse-dot" cx="50%" cy="0%" r="2" opacity="0">
			<animate attributeName="cy" from="0%" to="100%" dur="1.6s" begin="0.8s" repeatCount="indefinite" />
			<animate
				attributeName="opacity"
				values="0;0.6;0.6;0"
				keyTimes="0;0.15;0.85;1"
				dur="1.6s"
				begin="0.8s"
				repeatCount="indefinite"
			/>
		</circle>
	</svg>
{/snippet}

<ol class="flow" aria-label={m.showcase_ai_flow_aria()}>
	{#each layers as layer, i (layer.id)}
		{@const status = statusOf(layer.id)}
		<li class="row" data-status={status ?? 'rest'} data-shape={layer.shape}>
			<details>
				<summary
					bind:this={summaryEls[i]}
					tabindex={i === focusIndex ? 0 : -1}
					onkeydown={(e) => onSummaryKeydown(e, i)}
					onfocus={() => (focusIndex = i)}
				>
					{#if trace}
						<span class="glyph {STATUS_ICON[status ?? 'pending']}" aria-hidden="true"></span>
					{/if}
					<span class="name">{LAYER_NAMES[layer.id]()}</span>
					{#if layer.shape === 'loop'}
						<code class="chip">× {loopCap()}</code>
					{/if}
					{#if trace && status}
						<span class="status-text">{STATUS_LABELS[status]()}</span>
					{:else}
						<span class="role">{layerRole(layer.id, surface)}</span>
					{/if}
					<span class="i-lucide-chevron-down marker" aria-hidden="true"></span>
				</summary>
				<div class="inspector">
					<p class="inspector-role">{layerRole(layer.id, surface)}</p>
					<p class="inspector-meta">
						<span class="meta-label">{m.showcase_ai_inspector_source()}:</span>
						<code>{sourceOf(layer)}</code>
						{#if layer.doc}
							· <a href={localizeHref(layer.doc)}>{m.showcase_ai_inspector_docs()}</a>
						{/if}
					</p>
				</div>
			</details>
			{#if status === 'active'}
				{@render railPulse()}
			{/if}
			{#if layer.shape === 'lanes' && layer.lanes}
				<!-- Concurrent lanes, visible at rest — the dormant tiers ARE the claim. -->
				<ul class="lanes" aria-label={LAYER_NAMES[layer.id]()}>
					{#each layer.lanes.filter((lane) => lane.statusBySurface[surface]) as lane (lane.id)}
						{@const build = lane.statusBySurface[surface] ?? 'live'}
						<li class="lane" data-build={build}>
							<span class="lane-name">{LANE_LABELS[lane.id]?.() ?? lane.id}</span>
							<span class="lane-build">{BUILD_LABELS[build]()}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ol>

{#if surface === 'deskbot'}
	<!-- The approval replay is a SEPARATE HTTP request — a second stack, never a back-edge.
	     The shared proposal id is the only link (approval binds execution). -->
	<div class="replay">
		<p class="replay-note">{m.showcase_ai_replay_second_stack()}</p>
		<ol class="flow flow-replay" aria-label={m.showcase_ai_sec_approval()}>
			<li class="row">
				{#if halted}
					{@render railPulse()}
				{/if}
				<code class="chip">POST /api/ai/proposals/[id]/approve</code>
			</li>
			<li class="row"><code class="chip">grantedScopes</code> <span class="role">{m.showcase_ai_approval_frozen()}</span></li>
			<li class="row"><code class="chip">executeDeskToolCall(tool, args)</code></li>
			<li class="row row-terminal">
				<code class="chip">executed</code>
				<span class="either">|</span>
				<code class="chip">failed</code>
			</li>
		</ol>
	</div>
{/if}

<style>
	.flow {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.row {
		position: relative;
		padding-left: var(--spacing-4);
	}

	/* CSS connector — a vertical line; no SVG, reflows free at any zoom. */
	.row::before {
		content: '';
		position: absolute;
		left: 0.4rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-border);
	}

	.row:first-child::before {
		top: 50%;
	}

	.row:last-child::before {
		bottom: 50%;
	}

	.flow-replay .row::before {
		background: color-mix(in srgb, var(--color-warning) 50%, var(--color-border));
	}

	/* An 8px strip centered on the 2px rail (rail center = 0.4rem + 1px); cx=50%
	   lands on the rail, %-based cy stretches with the row — details expansion free. */
	.rail-pulse {
		position: absolute;
		left: calc(0.4rem + 1px - 4px);
		top: 0;
		bottom: 0;
		width: 8px;
		overflow: visible;
		pointer-events: none;
	}

	.row:first-child .rail-pulse {
		top: 50%;
	}

	.row:last-child .rail-pulse {
		bottom: 50%;
	}

	.pulse-dot {
		fill: var(--color-primary);
	}

	.flow-replay .pulse-dot {
		fill: var(--color-warning);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		min-height: 2.75rem;
		padding: var(--spacing-2);
		border-radius: var(--radius-md);
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		background: color-mix(in srgb, var(--color-subtle) 60%, transparent);
	}

	summary:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.row[data-status='active'] summary {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.row[data-status='error'] summary {
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
	}

	.glyph {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--color-muted);
	}

	.row[data-status='active'] .glyph {
		color: var(--color-primary);
	}

	.row[data-status='done'] .glyph {
		color: var(--color-success);
	}

	.row[data-status='error'] .glyph {
		color: var(--color-error);
	}

	.name {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.role {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.4;
		flex: 1;
		min-width: 12rem;
	}

	.status-text {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.chip {
		font-size: var(--text-fluid-xs);
		background: var(--color-subtle);
		padding: 0.1em 0.45em;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.marker {
		width: 1rem;
		height: 1rem;
		margin-left: auto;
		color: var(--color-muted);
		transition: transform 200ms;
	}

	details[open] .marker {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.marker {
			transition: none;
		}

		.rail-pulse {
			display: none;
		}
	}

	.inspector {
		padding: 0 var(--spacing-2) var(--spacing-3) var(--spacing-6);
	}

	.inspector-role {
		margin: 0 0 var(--spacing-1) 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.5;
	}

	.inspector-meta {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.inspector-meta code {
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
		word-break: break-all;
	}

	.inspector-meta a {
		color: var(--color-primary);
	}

	.meta-label {
		font-weight: 600;
	}

	/* Lanes: one row, side-by-side enclosure = happens-concurrently. Wraps at narrow
	   viewports; the geometry degrades, the labels still carry the claim. */
	.lanes {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin: 0 0 var(--spacing-2) var(--spacing-6);
		padding: var(--spacing-2);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.lane {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		min-width: 9rem;
	}

	/* dormant = built, not exercised here — hairline hatch, NEVER rendered as "skipped". */
	.lane[data-build='dormant'] {
		background: repeating-linear-gradient(
			135deg,
			transparent,
			transparent 5px,
			color-mix(in srgb, var(--color-muted) 12%, transparent) 5px,
			color-mix(in srgb, var(--color-muted) 12%, transparent) 6px
		);
		border-style: dashed;
	}

	.lane[data-build='planned'] {
		background: transparent;
		border-style: dotted;
	}

	.lane-name {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-fg);
	}

	.lane-build {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.replay {
		margin-top: var(--spacing-5);
		padding: var(--spacing-3);
		border: 1px solid color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
		border-radius: var(--radius-md);
	}

	.replay-note {
		margin: 0 0 var(--spacing-2) 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.flow-replay .row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 2.25rem;
		flex-wrap: wrap;
	}

	.either {
		color: var(--color-muted);
	}

	.row-terminal .chip:first-of-type {
		border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
	}

	.row-terminal .chip:last-of-type {
		border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent);
	}
</style>
