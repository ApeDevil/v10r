<script lang="ts">
import type { SvelteSet } from 'svelte/reactivity';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { type InspectorNode, visibleNodes } from '$lib/showcases/ai/inspector';
import { BLOCK_TAGS, GROUP_LABELS, STATE_LABELS } from '$lib/showcases/ai/labels';

// APG treeview over the inspector nodes: one tab stop, roving tabindex, arrows walk the
// visible rows, Right/Left expand and collapse, Enter opens the row in the detail pane.
// Flat markup with aria-level — every node is a real row, nothing is rendered collapsed
// off-screen. Human copy comes from labels.ts; identifiers (tool names, block tags,
// capability ids, model ids) render verbatim, as everywhere on this page.
let {
	nodes,
	expanded,
	selectedId,
	onselect,
	ontoggle,
}: {
	nodes: InspectorNode[];
	expanded: SvelteSet<string>;
	selectedId: string | null;
	onselect: (id: string) => void;
	ontoggle: (id: string) => void;
} = $props();

const rows = $derived(visibleNodes(nodes, expanded));
let focusedId = $state<string | null>(null);
let rowEls: Record<string, HTMLElement | undefined> = $state({});

const focusIndex = $derived(
	Math.max(
		0,
		rows.findIndex((r) => r.node.id === (focusedId ?? selectedId)),
	),
);

// A selection made outside the tree (a timeline bar) scrolls its row into the pane.
$effect(() => {
	if (selectedId) rowEls[selectedId]?.scrollIntoView({ block: 'nearest' });
});

function focusRow(index: number) {
	const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
	if (!row) return;
	focusedId = row.node.id;
	rowEls[row.node.id]?.focus();
}

function onKeydown(event: KeyboardEvent, index: number) {
	const row = rows[index];
	if (!row) return;
	switch (event.key) {
		case 'ArrowDown':
			focusRow(index + 1);
			break;
		case 'ArrowUp':
			focusRow(index - 1);
			break;
		case 'ArrowRight':
			if (row.expandable && !expanded.has(row.node.id)) ontoggle(row.node.id);
			else if (row.expandable) focusRow(index + 1);
			break;
		case 'ArrowLeft':
			if (row.expandable && expanded.has(row.node.id)) ontoggle(row.node.id);
			else if (row.parentId) focusRow(rows.findIndex((r) => r.node.id === row.parentId));
			break;
		case 'Home':
			focusRow(0);
			break;
		case 'End':
			focusRow(rows.length - 1);
			break;
		case 'Enter':
		case ' ':
			onselect(row.node.id);
			break;
		default:
			return;
	}
	event.preventDefault();
}

const STATE_VARIANT = {
	available: 'outline',
	considered: 'outline',
	included: 'secondary',
	executed: 'secondary',
	cited: 'success',
} as const;

// The proposal's lifecycle as a chip: the human's decision reads as text, never colour alone.
const PROPOSAL_VARIANT = {
	pending: 'warning',
	approved: 'secondary',
	executing: 'secondary',
	executed: 'success',
	rejected: 'outline',
	expired: 'outline',
	failed: 'error',
} as const;

const fmt = (n: number) => n.toLocaleString();
</script>

{#snippet label(node: InspectorNode)}
	{#if node.kind === 'group'}
		<span class="name">{GROUP_LABELS[node.group]()}</span>
		<span class="count">{fmt(node.count)}</span>
	{:else if node.kind === 'identity'}
		<code class="code">{node.name}</code>
		<span class="meta">{m.showcase_ai_orch_identity()}</span>
	{:else if node.kind === 'capability'}
		<code class="code">{node.capability.id}</code>
		{#if node.activation}
			<Badge variant={node.activation.active ? 'success' : 'outline'}>
				{node.activation.active ? m.showcase_ai_orch_active() : m.showcase_ai_orch_inactive()}
			</Badge>
			{#if node.activation.reason}<code class="reason">{node.activation.reason}</code>{/if}
		{/if}
	{:else if node.kind === 'tool-definition'}
		<code class="code">{node.tool.name}</code>
	{:else if node.kind === 'inventory'}
		<code class="code">{node.inventory.id}</code>
		<span class="meta">
			{m.showcase_ai_orch_documents({ n: fmt(node.inventory.documents) })}{#if node.inventory.chunks != null}
				· {m.showcase_ai_orch_chunks({ n: fmt(node.inventory.chunks) })}{/if}
		</span>
	{:else if node.kind === 'awareness'}
		<code class="code">{node.awareness.locale}</code>
		{#if node.awareness.authCeiling}<code class="code">{node.awareness.authCeiling}</code>{/if}
		{#if node.awareness.page}<span class="meta">{node.awareness.page.path}</span>{/if}
	{:else if node.kind === 'source'}
		<code class="code">{node.source.id}</code>
		{#if node.source.error}
			<Badge variant="error">{m.showcase_ai_status_error()}</Badge>
		{:else if !node.source.ran}
			<Badge variant="outline">{m.showcase_ai_status_skipped()}</Badge>
			{#if node.source.skippedReason}<code class="reason">{node.source.skippedReason}</code>{/if}
		{:else}
			<span class="meta">
				{m.showcase_ai_orch_candidates({ n: fmt(node.source.items.length), included: fmt(node.included) })}
			</span>
		{/if}
	{:else if node.kind === 'item'}
		<Badge variant={STATE_VARIANT[node.item.state]}>{STATE_LABELS[node.item.state]()}</Badge>
		<span class="name truncate">{node.item.title}</span>
		{#if node.item.score != null}<span class="num">{node.item.score.toFixed(3)}</span>{/if}
	{:else if node.kind === 'block'}
		<code class="code">{BLOCK_TAGS[node.block.id] ?? node.block.id}</code>
		<span class="meta">{m.showcase_ai_orch_chars({ n: fmt(node.block.chars) })}</span>
		<Badge variant={node.block.stable ? 'secondary' : 'warning'}>
			{node.block.stable ? m.showcase_ai_orch_stable() : m.showcase_ai_orch_dynamic()}
		</Badge>
	{:else if node.kind === 'history'}
		<span class="name">history</span>
		<span class="meta">
			{m.showcase_ai_orch_history({
				n: fmt(node.history.messages.length),
				dropped: fmt(node.history.droppedMessages),
			})}
		</span>
	{:else if node.kind === 'call'}
		<span class="name">{m.showcase_ai_orch_call({ n: String(node.index + 1) })}</span>
		{#if node.call.modelId}<code class="code">{node.call.modelId}</code>{/if}
		<span class="meta">{m.showcase_ai_orch_tokens({ input: fmt(node.call.inputTokens), output: fmt(node.call.outputTokens) })}</span>
		{#if node.call.response?.finishReason}<code class="reason">{node.call.response.finishReason}</code>{/if}
		{#if node.call.outcome !== 'ok'}<Badge variant="error">{node.call.outcome}</Badge>{/if}
	{:else if node.kind === 'tool'}
		<Badge variant={node.execution.status === 'error' ? 'error' : STATE_VARIANT.executed}>
			{node.execution.status === 'success' ? STATE_LABELS.executed() : node.execution.status}
		</Badge>
		<code class="code">{node.execution.toolName}</code>
		{#if node.execution.durationMs != null}<span class="num">{fmt(node.execution.durationMs)} ms</span>{/if}
	{:else if node.kind === 'attempt'}
		<span class="name">{m.showcase_ai_orch_attempt({ n: String(node.attempt.attemptIndex + 1) })}</span>
		{#if node.attempt.providerId}<code class="code">{node.attempt.providerId}</code>{/if}
		<Badge variant={node.attempt.outcome === 'ok' ? 'success' : node.attempt.outcome === 'started' ? 'outline' : 'error'}>
			{node.attempt.outcome}
		</Badge>
		{#if node.attempt.errorKind}<code class="reason">{node.attempt.errorKind}</code>{/if}
	{:else if node.kind === 'proposal'}
		<Badge variant={PROPOSAL_VARIANT[node.proposal.status]}>{node.proposal.status}</Badge>
		<span class="name truncate">{node.proposal.goal}</span>
		<code class="reason">{node.proposal.riskTier}</code>
	{:else if node.kind === 'proposal-step'}
		{#if node.receipt}
			<Badge variant={node.receipt.kind === 'ok' ? 'success' : 'error'}>{node.receipt.kind}</Badge>
		{:else}
			<Badge variant="outline">{m.showcase_ai_orch_step_not_run()}</Badge>
		{/if}
		<span class="name truncate">{node.step.action}</span>
		<code class="code">{node.step.tool}</code>
	{:else if node.kind === 'citation'}
		<code class="code">{node.citation.match}</code>
		<span class="name truncate">{node.citation.path ?? node.item?.title ?? node.citation.itemId}</span>
	{/if}
{/snippet}

<ul class="tree" role="tree" aria-label={m.showcase_ai_orch_tree_aria()}>
	{#each rows as row, i (row.node.id)}
		{@const open = row.expandable && expanded.has(row.node.id)}
		<li
			class="row"
			role="treeitem"
			aria-level={row.depth + 1}
			aria-expanded={row.expandable ? open : undefined}
			aria-selected={selectedId === row.node.id}
			tabindex={i === focusIndex ? 0 : -1}
			data-kind={row.node.kind}
			style="--depth: {row.depth}"
			bind:this={rowEls[row.node.id]}
			onkeydown={(e) => onKeydown(e, i)}
			onfocus={() => (focusedId = row.node.id)}
			onclick={() => onselect(row.node.id)}
		>
			{#if row.expandable}
				<!-- Component-First exception (custom interactive region): a mouse-only caret inside
				     the treeitem; the keyboard path is the row's own Left/Right. -->
				<button
					type="button"
					class="caret"
					tabindex="-1"
					aria-hidden="true"
					onclick={(e) => {
						e.stopPropagation();
						ontoggle(row.node.id);
					}}
				>
					<span class={open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'}></span>
				</button>
			{:else}
				<span class="caret caret-leaf" aria-hidden="true"></span>
			{/if}
			<span class="label">{@render label(row.node)}</span>
		</li>
	{/each}
</ul>

<style>
	.tree {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-2);
		padding-left: calc(var(--spacing-2) + var(--depth) * 1rem);
		border-radius: var(--radius-sm);
		cursor: pointer;
		min-width: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
	}

	.row:hover {
		background: var(--color-subtle);
	}

	.row[aria-selected='true'] {
		background: color-mix(in srgb, var(--color-primary) 12%, var(--color-subtle));
	}

	.row:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.row[data-kind='group'] .name {
		font-weight: 600;
	}

	.caret {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		flex-shrink: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.caret span {
		width: 0.9rem;
		height: 0.9rem;
	}

	.label {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		min-width: 0;
	}

	.name {
		color: var(--color-fg);
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 28ch;
	}

	.code,
	.reason {
		font-size: var(--text-fluid-xs);
		padding: 0.05em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.reason {
		color: var(--color-muted);
	}

	.count,
	.meta,
	.num {
		color: var(--color-muted);
	}

	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
