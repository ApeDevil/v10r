<!--
  nRAG Observability shell. One always-visible region under the chat with three coordinated
  views: Timing (spine, Step⟷Timeline toggle), Paths, Tokens. Modes are a post-hoc focus
  filter over one fused run — not page-states. See docs/blueprint/ai/nrag-observability.md.
-->
<script lang="ts">
import type { Chat } from '@ai-sdk/svelte';
import { MediaQuery } from 'svelte/reactivity';
import { browser } from '$app/environment';
import { Button, Tabs, ToggleGroup } from '$lib/components/primitives';
import type { NragPhase } from '$lib/types/pipeline';
import type { NragTraceState } from '../trace/nrag-trace.svelte';
import { PHASE_COLORS, PHASE_GLOSS } from '../trace/step-colors';
import NragWaterfall from './NragWaterfall.svelte';
import PathsPane from './PathsPane.svelte';
import StepList from './StepList.svelte';
import TokensPane from './TokensPane.svelte';

interface CounterfactualHandle {
	chat: Chat;
	run: () => void;
}

interface Props {
	rawrag: NragTraceState;
	llmwiki: NragTraceState;
	engine: 'rawrag' | 'llmwiki';
	isLoading: boolean;
	lastUserMessage: string;
	counterfactual?: CounterfactualHandle;
}

let { rawrag, llmwiki, engine, isLoading, lastUserMessage, counterfactual }: Props = $props();

const trace = $derived(engine === 'llmwiki' ? llmwiki : rawrag);

const VIEW_KEY = 'v10r:rag-chat:nrag-view';
const LAYOUT_KEY = 'v10r:rag-chat:nrag-layout';

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	if (!browser) return fallback;
	const raw = localStorage.getItem(key);
	return allowed.includes(raw as T) ? (raw as T) : fallback;
}

// --- Spine: Step ⟷ Timing view ---
let viewPref = $state<'auto' | 'step' | 'timing'>(readPref(VIEW_KEY, ['auto', 'step', 'timing'], 'auto'));
const autoView = $derived<'step' | 'timing'>(trace.isActive || trace.totalDurationMs === 0 ? 'step' : 'timing');
const effectiveView = $derived<'step' | 'timing'>(viewPref === 'auto' ? autoView : viewPref);

let viewSel = $state<string>(viewPref === 'auto' ? autoView : viewPref);
let prevEffective = effectiveView;
$effect(() => {
	const eff = effectiveView;
	const sel = viewSel;
	if (eff !== prevEffective) {
		prevEffective = eff;
		if (sel !== eff) viewSel = eff;
		return;
	}
	if (sel !== eff) {
		viewPref = sel === 'timing' ? 'timing' : 'step';
	}
});
$effect(() => {
	if (browser) localStorage.setItem(VIEW_KEY, viewPref);
});

const viewItems = [
	{ value: 'step', label: 'Steps' },
	{ value: 'timing', label: 'Timeline' },
];

// --- Detail region layout ---
let layoutPref = $state<string>(readPref(LAYOUT_KEY, ['auto', 'columns', 'rows'], 'auto'));
const wide = new MediaQuery('(min-width: 1100px)', true);
const layoutMode = $derived<'columns' | 'rows' | 'tabs'>(
	layoutPref === 'rows' ? 'rows' : layoutPref === 'columns' ? 'columns' : wide.current ? 'columns' : 'tabs',
);
$effect(() => {
	if (browser) localStorage.setItem(LAYOUT_KEY, layoutPref);
});
const layoutItems = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'columns', label: 'Columns' },
	{ value: 'rows', label: 'Expand' },
];

// --- Summary ---
const statusLabel = $derived(isLoading || trace.isActive ? 'Running' : trace.totalDurationMs > 0 ? 'Complete' : 'Idle');
const tokenTotal = $derived.by(() => {
	const tb = trace.tokenBreakdown;
	if (!tb) return null;
	if (tb.inputTokensReal == null && tb.outputTokensReal == null) return null;
	return (tb.inputTokensReal ?? 0) + (tb.outputTokensReal ?? 0);
});

// --- Counterfactual ---
const cfLoading = $derived(
	counterfactual ? counterfactual.chat.status === 'submitted' || counterfactual.chat.status === 'streaming' : false,
);
const cfText = $derived.by(() => {
	if (!counterfactual) return '';
	const msgs = counterfactual.chat.messages;
	for (let i = msgs.length - 1; i >= 0; i--) {
		const m = msgs[i];
		if (m.role === 'assistant') {
			return m.parts
				.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
				.map((p) => p.text)
				.join('\n');
		}
	}
	return '';
});

// --- Legend (always visible; doubles as the color key) ---
interface LegendStep {
	label: string;
	phase: NragPhase;
}
const legend = $derived<LegendStep[]>(
	engine === 'llmwiki'
		? [
				// One entry per PHASE in execution order. Drill is also a retrieve-phase step but
				// must NOT add a second 'retrieve' chip — it's a sub-step of the same lane.
				{ label: 'Overview / Search / Docs', phase: 'retrieve' },
				{ label: 'Context', phase: 'assemble' },
				{ label: 'Generate', phase: 'generate' },
				{ label: 'Verify', phase: 'verify' },
			]
		: [
				{ label: 'Embed', phase: 'embed' },
				{ label: 'Retrieve (3 lanes)', phase: 'retrieve' },
				{ label: 'Fuse', phase: 'fuse' },
				{ label: 'Context', phase: 'assemble' },
				{ label: 'Generate', phase: 'generate' },
			],
);
</script>

{#snippet pathsPane()}
	<PathsPane {trace} />
{/snippet}

{#snippet tokensPane()}
	<TokensPane {trace} />
{/snippet}

<section class="observability" aria-label="nRAG observability">
	<!-- Legend -->
	<div class="legend" aria-label="Pipeline phases">
		{#each legend as item, i (item.label)}
			{#if i > 0}<span class="legend-arrow" aria-hidden="true">→</span>{/if}
			<span class="legend-chip" title={PHASE_GLOSS[item.phase]}>
				<span class="legend-dot" style="background: {PHASE_COLORS[item.phase]};" aria-hidden="true"></span>
				{item.label}
			</span>
		{/each}
	</div>

	<!-- Summary row -->
	<div class="summary" aria-live="polite">
		<span class="summary-item">
			<span class="dot-status" class:running={isLoading || trace.isActive} aria-hidden="true"></span>
			<span class="status-text">{statusLabel}</span>
		</span>
		{#if trace.totalDurationMs > 0}
			<span class="summary-item mono">{trace.totalDurationMs}ms</span>
		{/if}
		{#if trace.summaryLabel}
			<span class="summary-item">{trace.summaryLabel}</span>
		{/if}
		{#if trace.drillCount > 0}
			<span class="summary-item">{trace.drillCount} drill{trace.drillCount === 1 ? '' : 's'}</span>
		{/if}
		<span class="summary-item mono tokens">
			{#if isLoading || trace.isActive}
				calculating…
			{:else if tokenTotal != null}
				{tokenTotal} tokens
			{:else}
				—
			{/if}
		</span>

		<div class="summary-actions">
			{#if counterfactual}
				<Button
					variant="secondary"
					size="sm"
					disabled={!lastUserMessage || cfLoading}
					onclick={() => counterfactual?.run()}
				>
					{#if cfLoading}
						<span class="i-lucide-loader-2 spin" aria-hidden="true"></span> Running…
					{:else}
						<span class="i-lucide-flask-conical" aria-hidden="true"></span> Run without RAG
					{/if}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Spine: Timing region -->
	<div class="spine" role="region" aria-label="Retrieval timing" aria-busy={isLoading || trace.isActive}>
		<div class="spine-head">
			<span class="region-title">Timing</span>
			<ToggleGroup type="single" size="sm" items={viewItems} bind:value={viewSel} />
		</div>
		<div class="spine-body">
			{#if effectiveView === 'step'}
				<StepList {trace} />
			{:else}
				<NragWaterfall {trace} />
			{/if}
		</div>
	</div>

	<!-- Counterfactual answer -->
	{#if counterfactual && cfText}
		<div class="cf-output">
			<span class="cf-label">No-RAG answer</span>
			<p class="cf-text">{cfText}</p>
		</div>
	{/if}

	<!-- Detail region: Paths | Tokens -->
	<div class="detail-region">
		<div class="detail-head">
			<span class="region-title">Detail</span>
			<ToggleGroup type="single" size="sm" items={layoutItems} bind:value={layoutPref} />
		</div>

		{#if layoutMode === 'tabs'}
			<Tabs
				tabs={[
					{ value: 'paths', label: 'Paths', content: pathsPane },
					{ value: 'tokens', label: 'Tokens', content: tokensPane },
				]}
			/>
		{:else}
			<div class="panes" class:cols={layoutMode === 'columns'} class:rows={layoutMode === 'rows'}>
				<div class="pane">
					<h3 class="pane-title">Paths</h3>
					{@render pathsPane()}
				</div>
				<div class="pane">
					<h3 class="pane-title">Tokens</h3>
					{@render tokensPane()}
				</div>
			</div>
		{/if}
	</div>
</section>

<style>
	.observability {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		container-type: inline-size;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--surface-2) 50%, transparent);
	}

	.legend-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: 11px;
		color: var(--color-fg);
	}

	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.legend-arrow {
		color: var(--color-muted);
		font-size: 11px;
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-3);
		font-size: 12px;
		color: var(--color-muted);
	}

	.summary-item {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.summary-item.mono {
		font-variant-numeric: tabular-nums;
		color: var(--color-fg);
	}

	.tokens {
		color: var(--color-muted);
	}

	.dot-status {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-muted);
	}

	.dot-status.running {
		background: var(--color-primary);
		animation: pulse 1s ease-in-out infinite;
	}

	.status-text {
		font-weight: 600;
		color: var(--color-fg);
	}

	.summary-actions {
		margin-left: auto;
	}

	.spine,
	.detail-region {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.spine-head,
	.detail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.region-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.panes.cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-5);
		align-items: start;
	}

	.panes.rows {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.pane-title {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.cf-output {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--surface-2) 50%, transparent);
	}

	.cf-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.cf-text {
		margin: 0;
		font-size: 12px;
		line-height: 1.6;
		color: var(--color-fg);
		white-space: pre-wrap;
	}

	.spin {
		animation: spin 1s linear infinite;
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
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot-status.running,
		.spin {
			animation: none;
		}
	}
</style>
