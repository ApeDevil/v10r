<script lang="ts">
import type { Component } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { Alert, EmptyState } from '$lib/components/composites';
import { Badge, Button, SkeletonCard, ToggleGroup } from '$lib/components/primitives';
import { Waterfall } from '$lib/components/viz';
import * as m from '$lib/paraglide/messages';
import { findInspectorNode, nodeIdOfRow, servedBy, timelineRows } from '$lib/showcases/ai/inspector';
import { OUTCOME_LABELS } from '$lib/showcases/ai/labels';
import ProvenanceBadge from './ProvenanceBadge.svelte';
import TurnItemDetail from './TurnItemDetail.svelte';
import TurnTree from './TurnTree.svelte';
import TurnGraphLegend from './turn-graph/TurnGraphLegend.svelte';
import TurnGraphList from './turn-graph/TurnGraphList.svelte';
import type { InspectorView, TurnInspectorState } from './turn-inspector.state.svelte';

// ONE turn, three views over one selection: the turn graph (sources → context and model
// calls → tools, drawn from recorded relations only), the tree (the accessible alternative,
// the five states in commitment order) and the timing. Selecting anywhere opens the same
// detail; the detail takes space only while something is selected. A live turn that is
// not there yet says so — the fixture never stands in for it.
let { inspector }: { inspector: TurnInspectorState } = $props();

const turn = $derived(inspector.current);
const trace = $derived(turn?.trace ?? null);
const tree = $derived(inspector.tree);
const graph = $derived(inspector.graph);
const selected = $derived.by(() => {
	const id = inspector.selectedId;
	if (!id) return null;
	return graph?.nodes.find((n) => n.id === id)?.detail ?? findInspectorNode(tree, id);
});
const rows = $derived(trace ? timelineRows(trace) : []);
const served = $derived(trace ? servedBy(trace) : null);

const fmt = (n: number) => n.toLocaleString();

// The canvas imports `@xyflow/svelte` statically; loading it here keeps the whole graph
// runtime out of the route's own bundle, and off narrow screens entirely.
const isDesktop = new MediaQuery('(min-width: 768px)', false);
let TurnGraphCanvas: Component<{
	graph: NonNullable<typeof graph>;
	turnKey: string;
	detailOpen: boolean;
	expanded: ReadonlySet<string>;
	selectedId: string | null;
	callId: string | null;
	onselect: (id: string | null) => void;
	ontoggle: (id: string) => void;
}> | null = $state(null);
$effect(() => {
	if (isDesktop.current && !TurnGraphCanvas) {
		import('./turn-graph/TurnGraphCanvas.svelte').then((module) => {
			TurnGraphCanvas = module.default;
		});
	}
});

const views = $derived([
	{ value: 'graph', label: m.showcase_ai_graph_view_graph() },
	{ value: 'tree', label: m.showcase_ai_graph_view_tree() },
	{ value: 'timeline', label: m.showcase_ai_graph_view_timeline() },
]);
// The selector's "every call" is a real item (bits-ui reads '' as nothing pressed).
const ALL_CALLS = 'all';
const callItems = $derived([
	{ value: ALL_CALLS, label: m.showcase_ai_graph_call_all() },
	...(graph?.calls.map((c) => ({ value: c.id, label: m.showcase_ai_graph_call_n({ n: String(c.index + 1) }) })) ?? []),
]);

function onTimelineSelect(rowId: string) {
	const id = nodeIdOfRow(rowId);
	if (id) inspector.select(id);
}
</script>

<div class="inspector">
	{#if turn && inspector.profileDrift}
		<Badge variant="warning">{m.showcase_ai_graph_profile_drift()}</Badge>
	{/if}

	{#if inspector.status === 'loading'}
		<p class="status" role="status">
			{inspector.retrying ? m.showcase_ai_graph_status_retrying() : m.showcase_ai_graph_status_loading()}
		</p>
		<SkeletonCard />
	{:else if inspector.status === 'error'}
		<Alert variant="error" description={m.showcase_ai_graph_status_error()} />
	{:else if inspector.status === 'idle' || !turn || !trace || !graph}
		<EmptyState title={m.showcase_ai_graph_status_idle()} />
	{:else}
		{#if inspector.status === 'streaming'}
			<p class="status live" role="status" aria-live="polite">
				<span class="dot" aria-hidden="true"></span>
				{m.showcase_ai_graph_status_streaming()}
			</p>
		{/if}

		<div class="turn">
			<p class="question">
				<span class="q-label">{m.showcase_ai_orch_question()}</span>
				{turn.question || '—'}
			</p>
			<div class="turn-facts">
				<ProvenanceBadge source={turn.provenance.kind} recordedAt={turn.provenance.recordedAt} />
				<Badge variant={trace.outcome === 'ok' ? 'success' : trace.outcome === 'error' ? 'error' : 'secondary'}>
					{OUTCOME_LABELS[trace.outcome]()}
				</Badge>
				<span>{m.showcase_ai_orch_calls({ n: fmt(trace.modelCalls.length) })}</span>
				<span>{m.showcase_ai_orch_tools({ n: fmt(trace.toolExecutions.length) })}</span>
				<span>{m.showcase_ai_orch_citations({ n: fmt(trace.citations.length) })}</span>
				{#if served}
					<span>{m.showcase_ai_orch_served_by()} <code>{served}</code></span>
				{/if}
			</div>
		</div>

		<div class="toolbar">
			<ToggleGroup
				type="single"
				size="sm"
				items={views}
				bind:value={() => inspector.view, (value) => {
					if (value) inspector.view = value as InspectorView;
				}}
			/>
			{#if graph.calls.length > 1}
				<ToggleGroup
					type="single"
					size="sm"
					items={callItems}
					bind:value={() => inspector.callId ?? ALL_CALLS, (value) => {
						inspector.callId = value && value !== ALL_CALLS ? String(value) : null;
					}}
				/>
			{/if}
		</div>

		<div class="split" class:open={selected !== null}>
			<div class="view">
				{#if inspector.view === 'graph'}
					{#if isDesktop.current && TurnGraphCanvas}
						<TurnGraphCanvas
							{graph}
							turnKey={trace.messageId}
							detailOpen={selected !== null}
							expanded={inspector.graphExpanded}
							selectedId={inspector.selectedId}
							callId={inspector.callId}
							onselect={(id) => inspector.select(id)}
							ontoggle={(id) => inspector.toggleGraph(id)}
						/>
					{:else}
						<TurnGraphList
							{graph}
							expanded={inspector.graphExpanded}
							selectedId={inspector.selectedId}
							callId={inspector.callId}
							onselect={(id) => inspector.select(id)}
							ontoggle={(id) => inspector.toggleGraph(id)}
						/>
					{/if}
					<TurnGraphLegend />
				{:else if inspector.view === 'tree'}
					<div class="tree-pane">
						<div class="tree-bar">
							<Button variant="ghost" size="sm" onclick={() => inspector.expandAll()}>{m.showcase_ai_orch_expand_all()}</Button>
							<Button variant="ghost" size="sm" onclick={() => inspector.collapseAll()}>{m.showcase_ai_orch_collapse_all()}</Button>
						</div>
						<TurnTree
							nodes={tree}
							expanded={inspector.expanded}
							selectedId={inspector.selectedId}
							onselect={(id) => inspector.select(id)}
							ontoggle={(id) => inspector.toggle(id)}
						/>
					</div>
				{:else if rows.length > 0}
					<div class="timeline" aria-label={m.showcase_ai_orch_timeline_aria()}>
						<Waterfall {rows} selectedId={inspector.selectedId} onselect={onTimelineSelect} />
					</div>
				{/if}
			</div>

			{#if selected}
				<div class="detail-pane">
					<div class="detail-bar">
						<Button
							variant="ghost"
							size="sm"
							aria-label={m.showcase_ai_graph_close_detail()}
							onclick={() => inspector.select(null)}
						>
							<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
							{m.showcase_ai_graph_close_detail()}
						</Button>
					</div>
					<TurnItemDetail node={selected} {turn} />
				</div>
			{:else}
				<p class="hint">{m.showcase_ai_graph_select_hint()}</p>
			{/if}
		</div>

		<p class="caveat">
			<span class="i-lucide-info h-3.5 w-3.5" aria-hidden="true"></span>
			{m.showcase_ai_orch_caveat()}
		</p>
	{/if}
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		min-width: 0;
	}

	.status {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.status.live {
		color: var(--color-fg);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-success);
		animation: turn-live 1.2s ease-in-out infinite;
	}

	@keyframes turn-live {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	.turn {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.question {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.5;
	}

	.q-label {
		display: inline-block;
		margin-right: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.turn-facts {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.turn-facts code {
		font-size: var(--text-fluid-xs);
		padding: 0.05em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-3);
		align-items: start;
	}

	.split.open {
		grid-template-columns: minmax(0, 3fr) minmax(20rem, 2fr);
	}

	@media (max-width: 64rem) {
		.split.open {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.view {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.timeline {
		min-width: 0;
	}

	.tree-pane,
	.detail-pane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		min-width: 0;
	}

	.tree-pane {
		max-height: 40rem;
		overflow: auto;
	}

	.detail-pane {
		max-height: 44rem;
		overflow: auto;
	}

	.tree-bar,
	.detail-bar {
		display: flex;
		gap: var(--spacing-1);
	}

	.hint,
	.caveat {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.caveat {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.caveat span {
		flex-shrink: 0;
		margin-top: 0.15rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
</style>
