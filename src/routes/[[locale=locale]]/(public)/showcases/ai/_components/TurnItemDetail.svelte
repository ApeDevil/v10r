<script lang="ts">
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { InspectedTurn, InspectorNode } from '$lib/showcases/ai/inspector';
import {
	BLOCK_TAGS,
	GROUP_GLOSSES,
	GROUP_LABELS,
	LANE_LABELS,
	LEVEL_LABELS,
	STATE_LABELS,
} from '$lib/showcases/ai/labels';

// The detail pane opens CONTENT, not counts: block text, chunk body, tool schema, tool
// input and output, call metadata. Field names are the trace contract's own
// (`$lib/types/turn-trace.ts`) and render as code — the contract is the subject here.
let { node, turn }: { node: InspectorNode | null; turn: InspectedTurn } = $props();

const fmt = (n: number) => n.toLocaleString();
const json = (value: unknown) => JSON.stringify(value, null, 2) ?? '';

/** A tool result the recorder capped: `{ capped, chars, preview }` instead of the value. */
function capped(value: unknown): { chars: number; preview: string } | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as { capped?: unknown; chars?: unknown; preview?: unknown };
	return v.capped === true && typeof v.preview === 'string'
		? { chars: Number(v.chars ?? 0), preview: v.preview }
		: null;
}

const redacted = $derived(turn.trace.bodies === 'redacted');
// The streamed snapshot withholds bodies; the persisted read brings them.
const pending = $derived(turn.trace.bodies === 'persisted');
const callIndex = (id: string) => turn.trace.modelCalls.findIndex((c) => c.id === id);
/** "Call n" for each recorded call id, in order — the executions and results a request carried. */
const callNames = (ids: string[]) =>
	ids
		.map((id) => callIndex(id))
		.filter((i) => i >= 0)
		.map((i) => m.showcase_ai_graph_call_n({ n: String(i + 1) }))
		.join(', ');
/** The later calls whose request carried this execution's result, by the recorded fact only. */
const resultInto = (toolCallId: string) =>
	turn.trace.modelCalls.filter((c) => c.request.toolResultIds?.includes(toolCallId)).map((c) => c.id);
</script>

{#snippet fact(name: string, value: string | number | null | undefined)}
	{#if value !== null && value !== undefined && value !== ''}
		<div class="fact">
			<dt><code>{name}</code></dt>
			<dd>{typeof value === 'number' ? fmt(value) : value}</dd>
		</div>
	{/if}
{/snippet}

{#snippet body(text: string | undefined, title: string)}
	{#if text}
		<div class="body">
			<span class="body-title">{title}</span>
			<pre class="pre">{text}</pre>
		</div>
	{:else if redacted}
		<p class="note">{m.showcase_ai_orch_redacted()}</p>
	{:else if pending}
		<p class="note">{m.showcase_ai_graph_bodies_pending()}</p>
	{:else}
		<p class="note">{m.showcase_ai_orch_no_body()}</p>
	{/if}
{/snippet}

{#snippet itemRow(item: InspectedTurn['trace']['grounding'][number]['items'][number])}
	<li class="row">
		<Badge variant={item.state === 'cited' ? 'success' : 'secondary'}>{STATE_LABELS[item.state]()}</Badge>
		<span class="row-title">{item.title}</span>
		{#if item.level}<span class="row-meta">{LEVEL_LABELS[item.level]()}</span>{/if}
		{#if item.chars !== undefined}<span class="row-meta">{m.showcase_ai_orch_chars({ n: fmt(item.chars) })}</span>{/if}
		{#if item.omittedReason}<code class="row-meta">{item.omittedReason}</code>{/if}
	</li>
{/snippet}

<div class="detail" aria-live="polite">
	{#if !node}
		<p class="empty">{m.showcase_ai_graph_select_hint()}</p>
	{:else if node.kind === 'group'}
		<h3 class="title">{GROUP_LABELS[node.group]()}</h3>
		<p class="gloss">{GROUP_GLOSSES[node.group]()}</p>
		<dl class="facts">{@render fact('count', node.count)}</dl>
		{#if node.group === 'proposal' && turn.trace.proposalId && !turn.trace.proposal}
			<p class="note">{m.showcase_ai_orch_proposal_unresolved()}</p>
			<dl class="facts">{@render fact('proposalId', turn.trace.proposalId)}</dl>
		{/if}
	{:else if node.kind === 'identity'}
		<h3 class="title"><code>{node.name}</code> · {m.showcase_ai_orch_identity()}</h3>
		{@render body(node.text, 'identity')}
	{:else if node.kind === 'capability'}
		<h3 class="title"><code>{node.capability.id}</code></h3>
		<dl class="facts">
			{@render fact('when', node.capability.when)}
			{@render fact('scope', node.capability.scope ? `${node.capability.scope.id} — ${node.capability.scope.description}` : null)}
			{@render fact('sources', node.capability.sources.join(', ') || null)}
			{@render fact('tools', node.capability.tools.map((t) => t.name).join(', ') || null)}
			{@render fact('activation', node.activation ? (node.activation.active ? m.showcase_ai_orch_active() : `${m.showcase_ai_orch_inactive()}${node.activation.reason ? ` · ${node.activation.reason}` : ''}`) : null)}
		</dl>
		{@render body(node.capability.guidance ?? undefined, 'guidance')}
	{:else if node.kind === 'tool-definition'}
		<h3 class="title"><code>{node.tool.name}</code></h3>
		<dl class="facts">
			{@render fact('capability', node.capability.id)}
			{@render fact('description', node.tool.description)}
		</dl>
		{@render body(json(node.tool.inputSchema), 'inputSchema')}
	{:else if node.kind === 'inventory'}
		<h3 class="title"><code>{node.inventory.id}</code></h3>
		<dl class="facts">
			{@render fact('documents', node.inventory.documents)}
			{@render fact('chunks', node.inventory.chunks)}
		</dl>
	{:else if node.kind === 'awareness'}
		<h3 class="title">{GROUP_LABELS.awareness()}</h3>
		<dl class="facts">
			{@render fact('locale', node.awareness.locale)}
			{@render fact('authCeiling', node.awareness.authCeiling)}
			{@render fact('page', node.awareness.page ? `${node.awareness.page.title} — ${node.awareness.page.path} (${node.awareness.page.surface})` : null)}
			{@render fact('scopes', node.awareness.scopes?.join(', ') || null)}
			{@render fact('workspace', node.awareness.workspace?.name)}
			{@render fact('layout', node.awareness.layout?.map((p) => `${p.label} (${p.fileType ?? 'panel'})`).join(', ') || null)}
			{@render fact('panels', node.awareness.panels?.map((p) => `${p.label} · ${fmt(p.chars)} chars${p.truncated ? ' · truncated' : ''}${p.dirty ? ' · unsaved' : ''}`).join('; ') || null)}
		</dl>
	{:else if node.kind === 'source'}
		<h3 class="title"><code>{node.source.id}</code></h3>
		<dl class="facts">
			{@render fact('ran', String(node.source.ran))}
			{@render fact('skippedReason', node.source.skippedReason)}
			{@render fact('error', node.source.error)}
			{@render fact('pool', node.source.pool)}
			{@render fact('cutoff', node.source.cutoff)}
			{@render fact('truncatedAt', node.source.truncatedAt)}
			{@render fact('startOffsetMs', node.source.startOffsetMs)}
			{@render fact('ms', node.source.ms)}
			{@render fact('retrievers', node.source.retrievers?.map((r) => LANE_LABELS[r]?.() ?? r).join(', ') ?? null)}
			{@render fact('items', node.source.items.length)}
		</dl>
	{:else if node.kind === 'document'}
		<h3 class="title">{node.title}</h3>
		<dl class="facts">
			{@render fact('source', node.source)}
			{@render fact('documentId', node.documentId)}
			{@render fact('path', node.path)}
			{@render fact('chunks', node.items.length)}
		</dl>
		<ul class="rows">
			{#each node.items as item (item.id)}{@render itemRow(item)}{/each}
		</ul>
	{:else if node.kind === 'parent-chunk'}
		<h3 class="title">{m.showcase_ai_graph_kind_parent()}</h3>
		{#if node.parent}
			<p class="gloss">{m.showcase_ai_graph_current_metadata()}</p>
			<dl class="facts">
				{@render fact('parentId', node.parentId)}
				{@render fact('level', LEVEL_LABELS[node.parent.level]())}
				{@render fact('position', node.parent.position)}
				{@render fact('chars', node.parent.chars)}
			</dl>
		{:else}
			<p class="note">{m.showcase_ai_graph_parent_unreadable()}</p>
			<dl class="facts">{@render fact('parentId', node.parentId)}</dl>
		{/if}
		<ul class="rows">
			{#each node.items as item (item.id)}{@render itemRow(item)}{/each}
		</ul>
	{:else if node.kind === 'omitted'}
		<h3 class="title">{m.showcase_ai_graph_kind_omitted()}</h3>
		<dl class="facts">
			{@render fact('source', node.source)}
			{@render fact('count', node.items.length)}
		</dl>
		<ul class="rows">
			{#each node.items as item (item.id)}{@render itemRow(item)}{/each}
		</ul>
	{:else if node.kind === 'item'}
		<h3 class="title">
			<Badge variant={node.item.state === 'cited' ? 'success' : 'secondary'}>{STATE_LABELS[node.item.state]()}</Badge>
			{node.item.title}
		</h3>
		<dl class="facts">
			{@render fact('kind', node.item.kind)}
			{@render fact('source', node.source)}
			{@render fact('path', node.item.path)}
			{@render fact('rank', node.item.rank)}
			{@render fact('score', node.item.score?.toFixed(4))}
			{@render fact('chars', node.item.chars)}
			{@render fact('level', node.item.level ? LEVEL_LABELS[node.item.level]() : null)}
			{@render fact('position', node.item.position)}
			{@render fact('parentId', node.item.parentId)}
			{@render fact('retriever', node.item.retriever ? (LANE_LABELS[node.item.retriever]?.() ?? node.item.retriever) : null)}
			{@render fact('blockId', node.item.blockId)}
			{@render fact('omittedReason', node.item.omittedReason)}
			{@render fact('toolCallId', node.item.toolCallId)}
			{@render fact('drifted', node.item.drifted ? m.showcase_ai_orch_drifted() : null)}
			{@render fact('contentHash', node.item.contentHash)}
			{@render fact('citation', node.citation ? node.citation.match : null)}
		</dl>
		{#if node.item.parent}
			<p class="gloss">{m.showcase_ai_graph_current_metadata()}</p>
			<dl class="facts">
				{@render fact('parent.level', LEVEL_LABELS[node.item.parent.level]())}
				{@render fact('parent.position', node.item.parent.position)}
				{@render fact('parent.chars', node.item.parent.chars)}
			</dl>
		{:else if node.item.parentId}
			<p class="note">{m.showcase_ai_graph_parent_unreadable()}</p>
		{/if}
		{#if node.item.kind === 'catalog' && node.item.catalog}
			<dl class="facts">
				{@render fact('catalog.surface', node.item.catalog.surface)}
				{@render fact('catalog.breadcrumb', node.item.catalog.breadcrumb.join(' › '))}
				{@render fact('catalog.anchor', node.item.catalog.anchor)}
			</dl>
		{:else}
			{@render body(node.item.body, 'body')}
		{/if}
	{:else if node.kind === 'block'}
		<h3 class="title"><code>{BLOCK_TAGS[node.block.id] ?? node.block.id}</code></h3>
		<dl class="facts">
			{@render fact('id', node.block.id)}
			{@render fact('capability', node.block.capability)}
			{@render fact('section', node.block.section)}
			{@render fact('stable', node.block.stable ? m.showcase_ai_orch_stable() : m.showcase_ai_orch_dynamic())}
			{@render fact('chars', node.block.chars)}
		</dl>
		{@render body(node.block.text, 'text')}
	{:else if node.kind === 'history'}
		<h3 class="title">history</h3>
		<p class="gloss">{m.showcase_ai_orch_history_gloss()}</p>
		<dl class="facts">{@render fact('droppedMessages', node.history.droppedMessages)}</dl>
		<ol class="messages">
			{#each node.history.messages as message, i (i)}
				<li>
					<code>{message.role}</code>
					{#each message.parts as part, j (j)}
						<span class="part">
							<code>{part.type}</code>{#if part.toolName}&nbsp;<code>{part.toolName}</code>{/if}
							· {m.showcase_ai_orch_chars({ n: fmt(part.chars) })}{#if part.ref}&nbsp;· <code>{part.ref}</code>{/if}
						</span>
					{/each}
				</li>
			{/each}
		</ol>
	{:else if node.kind === 'call'}
		<h3 class="title">{m.showcase_ai_orch_call({ n: String(node.index + 1) })}</h3>
		<dl class="facts">
			{@render fact('attemptIndex', node.call.attemptIndex)}
			{@render fact('stepIndex', node.call.stepIndex)}
			{@render fact('providerId', node.call.providerId)}
			{@render fact('modelId', node.call.modelId)}
			{@render fact('outcome', node.call.outcome)}
			{@render fact('inputTokens', node.call.inputTokens)}
			{@render fact('outputTokens', node.call.outputTokens)}
			{@render fact('cacheReadTokens', node.call.response?.cacheReadTokens)}
			{@render fact('reasoningTokens', node.call.response?.reasoningTokens)}
			{@render fact('durationMs', node.call.durationMs)}
			{@render fact('firstTokenMs', node.call.response?.firstTokenMs)}
			{@render fact('finishReason', node.call.response?.finishReason)}
			{@render fact('textChars', node.call.response?.textChars)}
			{@render fact('toolCalls', node.call.response?.toolCalls.map((t) => t.toolName).join(', ') || null)}
			{@render fact('responseModel', node.call.response?.responseModel)}
			{@render fact('responseId', node.call.response?.responseId)}
			{@render fact('warnings', node.call.response?.warnings?.join(' · ') || null)}
		</dl>
		<h4 class="subtitle">request</h4>
		<dl class="facts">
			{@render fact('systemHash', node.call.request.systemHash)}
			{@render fact('blockIds', node.call.request.blockIds.join(', ') || null)}
			{@render fact('historyCount', node.call.request.historyCount)}
			{@render fact('toolResultIds', node.call.request.toolResultIds === undefined ? m.showcase_ai_graph_not_recorded() : node.call.request.toolResultIds.join(', ') || '—')}
			{@render fact('toolsOffered', node.call.request.toolsOffered.join(', ') || '—')}
			{@render fact('toolChoice', node.call.request.toolChoice)}
			{@render fact('providerOptions', node.call.request.providerOptions ? json(node.call.request.providerOptions) : null)}
		</dl>
	{:else if node.kind === 'tool'}
		{@const cap = capped(node.execution.output)}
		<h3 class="title"><code>{node.execution.toolName}</code></h3>
		<dl class="facts">
			{@render fact('status', node.execution.status)}
			{@render fact('errorMessage', node.execution.errorMessage)}
			{@render fact('durationMs', node.execution.durationMs)}
			{@render fact('startOffsetMs', node.execution.startOffsetMs)}
			{@render fact('toolCallId', node.execution.toolCallId)}
			{@render fact('modelCallId', node.execution.modelCallId)}
			{@render fact('compaction', node.execution.compaction ? `${node.execution.compaction.ref} · ${fmt(node.execution.compaction.originalBytes)} bytes` : null)}
			{@render fact('description', node.definition?.description)}
		</dl>
		{@const into = resultInto(node.execution.toolCallId)}
		{@const from = node.execution.modelCallId ? callIndex(node.execution.modelCallId) : -1}
		{@const later = turn.trace.modelCalls.slice(from + 1)}
		{#if into.length > 0}
			<p class="note">{m.showcase_ai_graph_result_into({ calls: callNames(into) })}</p>
		{:else if later.length === 0}
			<p class="note">{m.showcase_ai_graph_no_later_request()}</p>
		{:else if later.every((c) => c.request.toolResultIds === undefined)}
			<p class="note">{m.showcase_ai_graph_next_request_unknown()}</p>
		{/if}
		{@render body(node.execution.input === undefined ? undefined : json(node.execution.input), 'input')}
		{#if cap}
			<p class="note">{m.showcase_ai_orch_capped({ n: fmt(cap.chars) })}</p>
			{@render body(cap.preview, 'output')}
		{:else}
			{@render body(node.execution.output === undefined ? undefined : json(node.execution.output), 'output')}
		{/if}
	{:else if node.kind === 'attempt'}
		<h3 class="title">{m.showcase_ai_orch_attempt({ n: String(node.attempt.attemptIndex + 1) })}</h3>
		<dl class="facts">
			{@render fact('providerId', node.attempt.providerId)}
			{@render fact('modelId', node.attempt.modelId)}
			{@render fact('outcome', node.attempt.outcome)}
			{@render fact('errorKind', node.attempt.errorKind)}
			{@render fact('contentParts', node.attempt.contentParts)}
		</dl>
	{:else if node.kind === 'proposal'}
		<h3 class="title">
			<Badge variant={node.proposal.status === 'executed' ? 'success' : node.proposal.status === 'failed' ? 'error' : 'secondary'}>
				{node.proposal.status}
			</Badge>
			{node.proposal.goal}
		</h3>
		<dl class="facts">
			{@render fact('id', node.proposal.id)}
			{@render fact('riskTier', node.proposal.riskTier)}
			{@render fact('steps', node.proposal.steps.length)}
			{@render fact('grantedScopes', node.proposal.grantedScopes.join(', ') || '—')}
			{@render fact('receipts', node.proposal.receipts.length)}
			{@render fact('failureMessage', node.proposal.failureMessage)}
			{@render fact('expiresAt', node.proposal.expiresAt)}
			{@render fact('approvedAt', node.proposal.approvedAt)}
			{@render fact('executedAt', node.proposal.executedAt)}
		</dl>
	{:else if node.kind === 'proposal-step'}
		<h3 class="title">
			<span>{m.showcase_ai_orch_step({ n: String(node.index + 1) })}</span>
			{node.step.action}
		</h3>
		<dl class="facts">
			{@render fact('tool', node.step.tool)}
			{@render fact('risk', node.step.risk)}
			{@render fact('recovery', node.step.recovery)}
			{@render fact('retentionDays', node.step.retentionDays)}
			{@render fact('rationale', node.step.rationale)}
			{@render fact('target', node.step.target ? `${node.step.target.name} · ${node.step.target.fileType}${node.step.target.version === null ? '' : ` · version ${node.step.target.version}`}` : null)}
			{@render fact('receipt', node.receipt ? node.receipt.kind : m.showcase_ai_orch_step_not_run())}
			{@render fact('errorMessage', node.receipt?.errorMessage)}
		</dl>
		{#if node.receipt?.output}
			{@render body(json(node.receipt.output), 'output')}
		{/if}
	{:else if node.kind === 'answer'}
		<h3 class="title">
			<Badge variant={node.outcome === 'ok' ? 'success' : node.outcome === 'error' ? 'error' : 'secondary'}>
				{node.outcome}
			</Badge>
			{m.showcase_ai_graph_kind_answer()}
		</h3>
		<dl class="facts">
			{@render fact('errorKind', node.errorKind)}
			{@render fact('citations', node.citations.length)}
			{@render fact('unsurfaced', node.unsurfaced)}
		</dl>
		{#if node.unsurfaced > 0}<p class="gloss">{m.showcase_ai_graph_unsurfaced_gloss()}</p>{/if}
		{#if node.citations.length > 0}
			<ul class="rows">
				{#each node.citations as citation, i (i)}
					<li class="row">
						<code class="row-meta">{citation.match}</code>
						<span class="row-title">{citation.path ?? citation.itemId}</span>
					</li>
				{/each}
			</ul>
		{/if}
		{@render body(node.answer || undefined, 'answer')}
	{:else if node.kind === 'toolset'}
		<h3 class="title">{m.showcase_ai_graph_kind_toolset()}</h3>
		<p class="gloss">{m.showcase_ai_graph_tools_gloss()}</p>
		<!-- Declared, offered and called are separate facts: the badges say the exceptions and the runs. -->
		<ul class="rows">
			{#each node.tools as tool (tool.name)}
				<li class="row">
					<code class="row-title">{tool.name}</code>
					{#if tool.executions > 0}
						<Badge variant={tool.failed > 0 ? 'error' : 'success'}>{m.showcase_ai_graph_tool_called({ n: fmt(tool.executions) })}</Badge>
					{/if}
					{#if tool.failed > 0}<Badge variant="error">{m.showcase_ai_graph_tool_failed({ n: fmt(tool.failed) })}</Badge>{/if}
					{#if !tool.offered}
						<Badge variant="muted">{m.showcase_ai_graph_tool_not_offered()}</Badge>
					{:else if !tool.declared}
						<Badge variant="warning">{m.showcase_ai_graph_tool_not_declared()}</Badge>
					{/if}
				</li>
			{/each}
		</ul>
		{#each node.tools as tool (tool.name)}
			{#if tool.inputSchema}
				{@render body(json(tool.inputSchema), tool.name)}
			{/if}
		{/each}
	{:else if node.kind === 'citation'}
		<h3 class="title"><code>{node.citation.match}</code> {node.citation.path ?? node.item?.title ?? ''}</h3>
		<p class="gloss">{m.showcase_ai_orch_match_gloss()}</p>
		<dl class="facts">
			{@render fact('source', node.citation.source)}
			{@render fact('itemId', node.citation.itemId)}
			{@render fact('path', node.citation.path)}
			{@render fact('answerStart', node.citation.answerStart)}
			{@render fact('answerEnd', node.citation.answerEnd)}
			{@render fact('known', node.citation.known === undefined ? null : node.citation.known ? m.showcase_ai_orch_known_yes() : m.showcase_ai_orch_known_no())}
		</dl>
		{#if node.citation.quote}
			{@render body(node.citation.quote, 'quote')}
		{/if}
	{/if}
</div>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		font-size: var(--text-fluid-xs);
		min-width: 0;
	}

	.row-title {
		color: var(--color-fg);
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.row-meta {
		color: var(--color-muted);
	}

	.empty,
	.gloss,
	.note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.title {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin: 0;
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
	}

	.title code,
	.messages code {
		font-size: var(--text-fluid-xs);
		padding: 0.05em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		font-weight: 500;
	}

	.facts {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin: 0;
	}

	.fact {
		display: grid;
		grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr);
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
	}

	.fact dt code {
		color: var(--color-muted);
	}

	.fact dd {
		margin: 0;
		color: var(--color-fg);
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.body-title {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: var(--font-mono);
	}

	.pre {
		margin: 0;
		padding: var(--spacing-3);
		max-height: 28rem;
		overflow: auto;
		font-size: var(--text-fluid-xs);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
	}

	.messages {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		margin: 0;
		padding-left: 1.25rem;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.part {
		margin-left: var(--spacing-2);
	}
</style>
