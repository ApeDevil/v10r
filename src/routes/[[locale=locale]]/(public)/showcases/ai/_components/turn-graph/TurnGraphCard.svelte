<script lang="ts">
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import {
	BLOCK_TAGS,
	KIND_LABELS,
	LANE_LABELS,
	LEVEL_LABELS,
	OUTCOME_LABELS,
	STATE_LABELS,
} from '$lib/showcases/ai/labels';
import type { TurnGraphNode } from '$lib/showcases/ai/turn-graph';
import type { TurnGraphCardVariant } from '$lib/showcases/ai/turn-graph-layout';

// One record of the turn graph — presentational only. The canvas node, the group node and
// the list row put the interaction around it (selection, focus, the expand toggle). Three
// shapes of one card: a standalone `card`, the `header` of a group (its box is the group's),
// and a compact member `row` (a block is one line, a chunk two). It says what kind of thing
// it is before its name; facts are text, never colour alone; what the record does not carry
// says "not recorded".
interface Props {
	node: TurnGraphNode;
	variant?: TurnGraphCardVariant;
	selected?: boolean;
	connected?: boolean;
	dimmed?: boolean;
	expanded?: boolean;
	class?: string;
}

let {
	node,
	variant = 'card',
	selected = false,
	connected = false,
	dimmed = false,
	expanded = false,
	class: className,
}: Props = $props();

const fmt = (n: number) => n.toLocaleString();
const detail = $derived(node.detail);
const stateVariant = (state: TurnGraphNode['state']) =>
	state === 'cited' ? 'success' : state === 'executed' ? 'default' : 'secondary';

/** The short sentence under the name — the facts this kind of record is read by. */
const facts = $derived.by((): string[] => {
	const out: string[] = [];
	if (!detail) return out;
	switch (detail.kind) {
		case 'source': {
			const s = detail.source;
			if (s.error) out.push(m.showcase_ai_graph_lane_error());
			else if (!s.ran || s.skippedReason) {
				if (s.skippedReason) out.push(m.showcase_ai_graph_lane_skipped({ reason: s.skippedReason }));
			}
			if (s.retrievers?.length) {
				out.push(
					m.showcase_ai_graph_retrievers_ran({
						retrievers: s.retrievers.map((r) => LANE_LABELS[r]?.() ?? r).join(', '),
					}),
				);
			}
			const inPrompt = s.items.filter((i) => i.state === 'included' || (i.state === 'cited' && i.blockId)).length;
			const surfaced = s.items.filter((i) => i.toolCallId !== undefined).length;
			const cited = s.items.filter((i) => i.state === 'cited').length;
			if (inPrompt) out.push(m.showcase_ai_graph_in_prompt({ n: fmt(inPrompt) }));
			if (surfaced) out.push(m.showcase_ai_graph_surfaced_by_tools({ n: fmt(surfaced) }));
			if (cited) out.push(m.showcase_ai_graph_cited_n({ n: fmt(cited) }));
			break;
		}
		case 'document':
			if (detail.path) out.push(detail.path);
			out.push(m.showcase_ai_graph_chunks_n({ n: fmt(detail.items.length) }));
			break;
		case 'parent-chunk':
			if (detail.parent) {
				// The kind tag already says "Section"; the level is worth a word only when it is not one.
				if (detail.parent.level !== 'section') out.push(LEVEL_LABELS[detail.parent.level]());
				out.push(m.showcase_ai_graph_position({ n: fmt(detail.parent.position) }));
				out.push(m.showcase_ai_orch_chars({ n: fmt(detail.parent.chars) }));
			} else out.push(m.showcase_ai_graph_parent_unreadable());
			break;
		case 'item': {
			const i = detail.item;
			if (i.level) out.push(LEVEL_LABELS[i.level]());
			if (i.score !== undefined) out.push(`#${i.rank + 1} · ${i.score.toFixed(3)}`);
			else out.push(`#${i.rank + 1}`);
			if (i.chars !== undefined) out.push(m.showcase_ai_orch_chars({ n: fmt(i.chars) }));
			if (i.retriever) out.push(LANE_LABELS[i.retriever]?.() ?? i.retriever);
			if (i.omittedReason) out.push(i.omittedReason);
			if (i.drifted) out.push(m.showcase_ai_orch_drifted());
			break;
		}
		case 'omitted':
			out.push(m.showcase_ai_graph_omitted({ n: fmt(detail.items.length) }));
			break;
		case 'block':
			out.push(m.showcase_ai_orch_chars({ n: fmt(detail.block.chars) }));
			break;
		case 'history':
			out.push(m.showcase_ai_graph_messages_n({ n: fmt(detail.history.messages.length) }));
			if (detail.history.droppedMessages > 0) {
				out.push(m.showcase_ai_graph_dropped_n({ n: fmt(detail.history.droppedMessages) }));
			}
			break;
		case 'call': {
			const c = detail.call;
			if (c.providerId || c.modelId) out.push([c.providerId, c.modelId].filter(Boolean).join(' / '));
			if (c.response?.finishReason) out.push(c.response.finishReason);
			if (c.response && c.response.toolCalls.length > 0) {
				out.push(m.showcase_ai_graph_tool_calls_n({ n: fmt(c.response.toolCalls.length) }));
			}
			if (node.flags.active) out.push(m.showcase_ai_graph_running());
			if (node.flags.unknown.includes('toolResultIds')) {
				out.push(`toolResultIds: ${m.showcase_ai_graph_not_recorded()}`);
			}
			break;
		}
		case 'answer':
			out.push(m.showcase_ai_graph_cited_n({ n: fmt(detail.citations.length - detail.unsurfaced) }));
			if (detail.unsurfaced > 0) out.push(m.showcase_ai_graph_unsurfaced({ n: fmt(detail.unsurfaced) }));
			if (detail.errorKind) out.push(detail.errorKind);
			break;
		case 'proposal':
			out.push(detail.proposal.riskTier);
			out.push(fmt(detail.proposal.steps.length));
			break;
		case 'group': {
			if (detail.group === 'prompt') {
				const blocks = detail.children.flatMap((c) => (c.kind === 'block' ? [c.block] : []));
				const stable = blocks.filter((b) => b.stable).length;
				out.push(m.showcase_ai_graph_blocks_n({ n: fmt(blocks.length) }));
				out.push(
					`${fmt(stable)} ${m.showcase_ai_orch_stable()} · ${fmt(blocks.length - stable)} ${m.showcase_ai_orch_dynamic()}`,
				);
				out.push(m.showcase_ai_orch_chars({ n: fmt(blocks.reduce((n, b) => n + b.chars, 0)) }));
			} else out.push(m.showcase_ai_orch_proposal_unresolved());
			break;
		}
		case 'toolset': {
			const t = detail.tools;
			out.push(m.showcase_ai_graph_tools_declared_n({ n: fmt(t.filter((x) => x.declared).length) }));
			out.push(m.showcase_ai_graph_tools_offered_n({ n: fmt(t.filter((x) => x.offered).length) }));
			out.push(m.showcase_ai_graph_tools_called_n({ n: fmt(t.filter((x) => x.executions > 0).length) }));
			break;
		}
		case 'tool': {
			const e = detail.execution;
			if (e.durationMs !== undefined) out.push(`${fmt(e.durationMs)} ms`);
			if (e.compaction) out.push(e.compaction.ref);
			if (node.flags.unknown.includes('modelCallId')) out.push(`modelCallId: ${m.showcase_ai_graph_not_recorded()}`);
			if (node.flags.unknown.includes('toolResultIds')) out.push(m.showcase_ai_graph_next_request_unknown());
			break;
		}
		default:
			break;
	}
	return out;
});

const name = $derived.by((): string => {
	if (!detail) return '';
	switch (detail.kind) {
		case 'block':
			return BLOCK_TAGS[detail.block.id] ?? detail.block.id;
		case 'call':
			return m.showcase_ai_graph_call_n({ n: String(detail.index + 1) });
		case 'parent-chunk':
		case 'omitted':
		case 'history':
		case 'toolset':
		case 'answer':
		case 'group':
			return '';
		case 'proposal':
			return detail.proposal.status;
		default:
			return node.label;
	}
});

const isCode = $derived(node.kind === 'source' || node.kind === 'block' || node.kind === 'tool');
/** A one-line member row: a block under the prompt's header, the folded omitted candidates. */
const oneLine = $derived(variant === 'row' && (node.kind === 'block' || node.kind === 'omitted'));
// A one-line row keeps its name whole: a block's size and an omitted group's count are the header's and the detail's.
const rowFacts = $derived(node.kind === 'omitted' || node.kind === 'block' ? [] : facts);
</script>

<div
	class="card {className ?? ''}"
	class:selected
	class:connected
	class:dimmed
	class:active={node.flags.active}
	class:failed={node.flags.failed}
	class:one-line={oneLine}
	data-kind={node.kind}
	data-column={node.column}
	data-state={node.state ?? ''}
	data-variant={variant}
>
	{#if node.kind === 'boundary'}
		<span class="boundary-label">{m.showcase_ai_graph_kind_boundary()}</span>
	{:else if oneLine}
		<!-- One line: the name, then its facts (a block's side of the cache boundary is the divider's to say). -->
		<span class="row-name" title={name}>{#if isCode}<code>{name}</code>{:else}{name || KIND_LABELS[node.kind]()}{/if}</span>
		{#if rowFacts.length > 0}<span class="row-facts">{rowFacts.join(' · ')}</span>{/if}
		{#if node.flags.inCall}<Badge variant="outline" class="turn-badge">{m.showcase_ai_graph_in_call()}</Badge>{/if}
		{#if node.expandable && node.count !== undefined}
			<span class="count" aria-hidden="true">{expanded ? '▾' : '▸'} {fmt(node.count)}</span>
		{/if}
	{:else}
		<div class="head">
			<span class="kind">{KIND_LABELS[node.kind]()}</span>
			{#if variant === 'header' && name}
				<span class="head-name" title={name}>{#if isCode}<code>{name}</code>{:else}{name}{/if}</span>
			{/if}
			{#if node.state}
				<Badge variant={stateVariant(node.state)} class="turn-badge">{STATE_LABELS[node.state]()}</Badge>
			{:else if node.kind === 'answer' && detail?.kind === 'answer'}
				<Badge variant={detail.outcome === 'ok' ? 'success' : detail.outcome === 'error' ? 'error' : 'secondary'} class="turn-badge">
					{OUTCOME_LABELS[detail.outcome]()}
				</Badge>
			{:else if node.kind === 'tool' && detail?.kind === 'tool'}
				<Badge
					variant={detail.execution.status === 'success' ? 'success' : detail.execution.status === 'error' ? 'error' : 'warning'}
					class="turn-badge"
				>
					{detail.execution.status}
				</Badge>
			{:else if node.flags.inCall}
				<Badge variant="outline" class="turn-badge">{m.showcase_ai_graph_in_call()}</Badge>
			{/if}
			{#if node.expandable && node.count !== undefined}
				<span class="count" aria-hidden="true">{expanded ? '▾' : '▸'} {fmt(node.count)}</span>
			{/if}
		</div>
		{#if name && variant !== 'header'}
			<p class="name" title={name}>{#if isCode}<code>{name}</code>{:else}{name}{/if}</p>
		{/if}
		{#if facts.length > 0}
			<p class="facts">{facts.join(' · ')}</p>
		{/if}
		{#if node.kind === 'toolset' && detail?.kind === 'toolset'}
			<ul class="tools">
				{#each detail.tools as tool (tool.name)}
					<li class="tool-row" class:quiet={!tool.offered}>
						<code>{tool.name}</code>
						<span class="tool-badges">
							{#if tool.executions > 0}
								<Badge variant={tool.failed > 0 ? 'error' : 'success'} class="turn-badge">
									{m.showcase_ai_graph_tool_called({ n: fmt(tool.executions) })}
								</Badge>
							{/if}
							{#if tool.failed > 0}
								<Badge variant="error" class="turn-badge">{m.showcase_ai_graph_tool_failed({ n: fmt(tool.failed) })}</Badge>
							{/if}
							{#if !tool.offered}
								<Badge variant="muted" class="turn-badge">{m.showcase_ai_graph_tool_not_offered()}</Badge>
							{:else if !tool.declared}
								<Badge variant="warning" class="turn-badge">{m.showcase_ai_graph_tool_not_declared()}</Badge>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.card {
		box-sizing: border-box;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px var(--spacing-3);
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--turn-accent);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--color-fg);
		font-size: var(--text-fluid-xs);
		line-height: 1.35;
		overflow: hidden;
		text-align: left;
		transition:
			border-color var(--duration-fast),
			opacity var(--duration-fast),
			box-shadow var(--duration-fast);
	}

	.card[data-column='sources'] {
		--turn-accent: var(--chart-2);
	}

	.card[data-column='context'] {
		--turn-accent: var(--chart-1);
	}

	.card[data-column='tools'] {
		--turn-accent: var(--chart-5);
	}

	/* A member row: tighter, and a chunk keeps its two lines while a block is one. */
	.card[data-variant='row'] {
		padding: 4px var(--spacing-2);
		gap: 1px;
	}

	.card.one-line {
		flex-direction: row;
		align-items: center;
		gap: var(--spacing-2);
	}

	/* The header of a group: the group's box carries the border and the tint. */
	.card[data-variant='header'] {
		border: 0;
		border-radius: 0;
		background: transparent;
		padding: 5px var(--spacing-3);
	}

	.card[data-kind='boundary'] {
		border: 0;
		background: transparent;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.boundary-label {
		width: 100%;
		text-align: center;
		color: var(--color-muted);
		font-size: 10px;
		letter-spacing: 0.02em;
		border-top: 1px dashed var(--color-border);
		padding-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card.connected {
		border-color: var(--color-primary);
	}

	.card.selected {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.card.dimmed {
		opacity: 0.45;
	}

	.card.failed {
		border-color: var(--color-error-fg);
	}

	.card.active {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
	}

	/* A host that puts a toggle in the corner reserves the room with `--turn-card-inset`. */
	.head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
		padding-right: var(--turn-card-inset, 0);
	}

	.card.one-line {
		padding-right: calc(var(--spacing-2) + var(--turn-card-inset, 0px));
	}

	.kind {
		color: var(--color-muted);
		text-transform: uppercase;
		font-size: 10px;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.head-name {
		font-weight: 600;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		margin-left: auto;
		color: var(--color-muted);
		white-space: nowrap;
	}

	.name {
		margin: 0;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name code,
	.head-name code,
	.row-name code {
		font-weight: 500;
	}

	.row-name {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 1;
		min-width: 4rem;
	}

	.row-facts {
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 2;
	}

	.facts {
		margin: 0;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tools {
		margin: 2px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.tool-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		height: 24px;
		white-space: nowrap;
		overflow: hidden;
	}

	.tool-row code {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tool-row.quiet {
		color: var(--color-muted);
	}

	.tool-badges {
		margin-left: auto;
		display: inline-flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.card :global(.turn-badge) {
		font-size: 10px;
		line-height: 1.4;
		padding: 0 6px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
	}
</style>
