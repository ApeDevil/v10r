<script lang="ts">
import CitationChip from '#lib/components/composites/citation/CitationChip.svelte';
import type { CatalogSource } from '#lib/components/composites/citation/citation-types.ts';
import {
	LazyGenerativeSurface,
	localizedGenerativeSurfaceLabels,
} from '#lib/components/composites/generative-surface/index.ts';
import type { GenerativeSurfaceAction } from '#lib/generative-ui/index.ts';
import { ownSurfaceActionRecordOf } from '#lib/generative-ui/surface-action-key.ts';
import * as m from '#lib/paraglide/messages.js';
import type { TurnError } from '#lib/types/ai-error.ts';
import { cn } from '#lib/utils/cn.ts';
import StreamedMarkdown from './StreamedMarkdown.svelte';
import { RENDER_SURFACE_PART, type SurfaceView } from './surface-views';
import ToolCallStatus from './ToolCallStatus.svelte';
import { toolLabel } from './tool-label';
import { isToolPart, TOOL_PHASE, type ToolPart, toolNameOf, toolPartFailed } from './tool-part';

interface TextPart {
	type: 'text';
	text: string;
	/** AI SDK sets this while deltas are still arriving; absent on persisted history. */
	state?: 'streaming' | 'done';
}

type MessagePart = TextPart | ToolPart | { type: string };

interface Props {
	role: 'user' | 'assistant';
	/** v6 parts array — preferred for assistant messages */
	parts?: MessagePart[];
	/** Fallback content string — used when parts is unavailable */
	content?: string;
	/** Grounded catalog surfaces the assistant referenced — rendered as citation chips. */
	catalogSources?: CatalogSource[];
	/** Why the answer stopped short (streamed on the message when a turn failed after its first words). */
	turnError?: TurnError;
	/** Where the finished turn opens in the turn inspector — set once its trace has persisted. */
	inspectHref?: string | null;
	/** The view each `render_surface` part shows (`surfaceViewsOf` over the whole thread). */
	surfaceViews?: ReadonlyMap<string, SurfaceView | null>;
	/** A Button was pressed on one of this message's surfaces — an event, never an approval. */
	onsurfaceaction?: (action: GenerativeSurfaceAction, renderId: string) => void;
}

let {
	role,
	parts,
	content,
	catalogSources,
	turnError,
	inspectHref = null,
	surfaceViews,
	onsurfaceaction,
}: Props = $props();

const surfaceLabels = $derived(localizedGenerativeSurfaceLabels());

const isUser = $derived(role === 'user');

/**
 * Dedupe citation chips by (path, anchor). Docs retrieval surfaces several
 * CHUNKS of the same doc → identical paths; the keyed {#each} below (keyed by
 * path+anchor) would otherwise throw each_key_duplicate, crashing the chip row
 * AND wedging the chat loading state. The server collapses these too — this is
 * a defensive second layer so the render can never hard-crash on shape.
 */
const uniqueSources = $derived.by((): CatalogSource[] => {
	if (!catalogSources?.length) return [];
	const seen = new Set<string>();
	const out: CatalogSource[] = [];
	for (const s of catalogSources) {
		const key = `${s.path} ${s.anchor ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(s);
	}
	return out;
});

/** Resolve display parts: prefer parts array, fall back to wrapping content as a text part */
const displayParts = $derived.by((): MessagePart[] => {
	if (parts?.length) return parts;
	if (content) return [{ type: 'text', text: content }];
	return [];
});

function getTextContent(part: MessagePart): string {
	return 'text' in part ? (part as TextPart).text : '';
}

function isStreaming(part: MessagePart): boolean {
	return 'state' in part && (part as TextPart).state === 'streaming';
}

/**
 * An assistant frame exists from the stream's first `start` on and stays after a pre-text
 * failure; with nothing to show, the row is not rendered — the status row and the error box
 * speak for those states.
 */
const hasContent = $derived(
	displayParts.some((p) =>
		p.type === 'text' ? !!getTextContent(p) : isToolPart(p) || ownSurfaceActionRecordOf(p) !== null,
	) ||
		uniqueSources.length > 0 ||
		!!turnError,
);

// A turn error is the server's classification of the provider's failure mid-answer, so a
// rate limit here is the model's, never this user's message rate.
function turnErrorCopy(error: TurnError): string {
	if (error.kind === 'rate_limit') return m.ai_chat_error_provider_limited();
	if (error.kind === 'unavailable' || error.kind === 'timeout') return m.ai_chat_error_unavailable();
	return m.ai_chat_error_generic();
}
</script>

{#if hasContent}
<div class={cn('chat-message flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
	<div
		class={cn(
			'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
			isUser ? 'bg-primary text-white' : 'chat-avatar-assistant'
		)}
	>
		<span class={cn(isUser ? 'i-lucide-user' : 'i-lucide-bot', 'h-4 w-4')}></span>
	</div>

	<div class="chat-message-body flex max-w-[80%] flex-col gap-1">
		{#each displayParts as part}
			{#if part.type === 'text'}
				{@const text = getTextContent(part)}
				{#if text}
					<div
						class={cn(
							'chat-bubble rounded-lg px-4 py-2 text-fluid-sm',
							isUser ? 'chat-bubble-user text-white' : 'chat-bubble-assistant text-fg'
						)}
					>
						{#if isUser}
							<p class="whitespace-pre-wrap">{text}</p>
						{:else}
							<div class="chat-prose"><StreamedMarkdown {text} streaming={isStreaming(part)} /></div>
						{/if}
					</div>
				{/if}
			{:else if ownSurfaceActionRecordOf(part)}
				{@const press = ownSurfaceActionRecordOf(part)}
				<!-- A Button press, recorded as data: the user sees one line, never the
				     untrusted-content prompt the model reads (rebuilt server-side per turn). -->
				<div class="chat-bubble chat-bubble-user rounded-lg px-4 py-2 text-fluid-sm text-white" data-surface-action-line>
					<p class="whitespace-pre-wrap">{m.ai_chat_surface_action_sent({ event: press?.action.name ?? '' })}</p>
				</div>
			{:else if part.type === RENDER_SURFACE_PART && isToolPart(part) && surfaceViews?.has(part.toolCallId)}
				{@const view = surfaceViews.get(part.toolCallId)}
				{#if view}
					<div class="chat-surface">
						<LazyGenerativeSurface
							messages={view.messages}
							labels={surfaceLabels}
							onaction={(action) => onsurfaceaction?.(action, view.renderId)}
						/>
					</div>
				{/if}
			{:else if isToolPart(part)}
				{@const toolName = toolNameOf(part)}
				<ToolCallStatus label={toolLabel(toolName)} phase={toolPartFailed(part) ? 'error' : (TOOL_PHASE[part.state] ?? 'running')} output={part.output} />
			{/if}
		{/each}

		{#if turnError}
			<!-- The turn failed after its first words: the text above is what arrived. -->
			<p class="turn-error text-fluid-xs" role="status">
				<span class="i-lucide-alert-circle turn-error-icon" aria-hidden="true"></span>
				<span class="font-medium">{m.ai_chat_error_partial()}</span>
				{turnErrorCopy(turnError)}
			</p>
		{/if}

		{#if !isUser && uniqueSources.length}
			<div class="related-surfaces">
				<span class="related-label">Related surfaces</span>
				<div class="related-chips" role="list">
					{#each uniqueSources as src (src.path + (src.anchor ?? ''))}
						<div role="listitem">
							<CitationChip
								surface={src.surface}
								title={src.title}
								path={src.path}
								anchor={src.anchor}
								breadcrumb={src.breadcrumb}
								icon={src.icon}
								badge={src.badge}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if !isUser && inspectHref}
			<!-- The turn's own recorded account, one click away — the showcase opens the persisted trace. -->
			<a class="inspect-turn" href={inspectHref}>
				<span class="i-lucide-scan-search inspect-turn-icon" aria-hidden="true"></span>
				{m.ai_chat_inspect_turn()}
			</a>
		{/if}
	</div>
</div>
{/if}

<style>
	.chat-surface {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		padding: 0.75rem;
	}

	.chat-avatar-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.turn-error {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm, 4px);
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		color: var(--color-error-fg);
	}
	.turn-error-icon {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
	}

	/* Narrow viewports: bubbles reclaim the width the desktop 80% cap wastes.
	   div.chat-message outweighs the px/py utilities; the descendant selector
	   outweighs max-w-[80%]. */
	@media (max-width: 767px) {
		div.chat-message {
			padding: 10px;
			gap: 8px;
		}

		.chat-message .chat-message-body {
			max-width: 90%;
		}
	}

	.related-surfaces {
		margin-top: 0.25rem;
	}

	.inspect-turn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		align-self: flex-start;
		margin-top: 0.125rem;
		font-size: 0.6875rem;
		color: var(--color-muted);
		text-decoration: none;
	}

	.inspect-turn:hover {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.inspect-turn-icon {
		width: 0.75rem;
		height: 0.75rem;
	}
	.related-label {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}
	.related-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.chat-bubble-user {
		background-color: var(--color-primary);
	}

	.chat-bubble-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.chat-prose :global(h1),
	.chat-prose :global(h2),
	.chat-prose :global(h3),
	.chat-prose :global(h4),
	.chat-prose :global(h5),
	.chat-prose :global(h6) {
		font-weight: 600;
		margin-bottom: 0.25em;
		margin-top: 0.75em;
		line-height: 1.3;
	}

	.chat-prose :global(h1) { font-size: 1.25em; }
	.chat-prose :global(h2) { font-size: 1.15em; }
	.chat-prose :global(h3) { font-size: 1.05em; }

	/* A host that reads the answer at page width asks for more room with the two knobs. */
	.chat-prose {
		line-height: var(--chat-prose-leading, 1.5);
	}

	.chat-prose :global(p) {
		margin-bottom: var(--chat-prose-paragraph-gap, 0.5em);
	}

	.chat-prose :global(p:last-child) {
		margin-bottom: 0;
	}

	.chat-prose :global(code) {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: 0.875em;
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border-radius: 4px;
		padding: 0.15em 0.35em;
	}

	.chat-prose :global(pre) {
		margin: 0.5em 0;
		border-radius: 6px;
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
		overflow-x: auto;
	}

	.chat-prose :global(pre > code) {
		display: block;
		padding: 0.75em 1em;
		background: none;
		border-radius: 0;
		font-size: 0.8em;
		line-height: 1.5;
	}

	.chat-prose :global(ul),
	.chat-prose :global(ol) {
		padding-left: 1.5em;
		margin-bottom: var(--chat-prose-paragraph-gap, 0.5em);
	}

	.chat-prose :global(ul) { list-style: disc; }
	.chat-prose :global(ol) { list-style: decimal; }

	.chat-prose :global(li) {
		margin-bottom: 0.15em;
	}

	.chat-prose :global(a) {
		color: var(--color-primary);
		text-decoration: none;
	}

	.chat-prose :global(a:hover) {
		text-decoration: underline;
	}

	.chat-prose :global(blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 0.75em;
		margin: 0.5em 0;
		font-style: italic;
		color: var(--color-muted);
	}

	.chat-prose :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.9em;
		width: 100%;
	}

	.chat-prose :global(th),
	.chat-prose :global(td) {
		border: 1px solid var(--color-border);
		padding: 0.35em 0.6em;
		text-align: left;
	}

	.chat-prose :global(th) {
		font-weight: 600;
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	.chat-prose :global(hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 0.75em 0;
	}

	.chat-prose :global(del) {
		text-decoration: line-through;
		opacity: 0.7;
	}
</style>
