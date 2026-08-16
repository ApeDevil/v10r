<script lang="ts">
import CitationChip from '$lib/components/chat/CitationChip.svelte';
import ConfirmationCard from '$lib/components/chat/ConfirmationCard.svelte';
import type { CatalogSource, SourceChunk } from '$lib/components/chat/citation-types';
import { cn } from '$lib/utils/cn';
import { renderMarkdown } from '$lib/utils/markdown';
import ToolCallStatus from './ToolCallStatus.svelte';

interface TextPart {
	type: 'text';
	text: string;
}

interface ToolInvocationPart {
	type: 'tool-invocation';
	toolInvocation: {
		toolName: string;
		toolCallId: string;
		state: 'call' | 'partial-call' | 'result';
		args?: unknown;
		output?: unknown;
	};
}

type MessagePart = TextPart | ToolInvocationPart | { type: string };

interface Props {
	role: 'user' | 'assistant';
	/** v6 parts array — preferred for assistant messages */
	parts?: MessagePart[];
	/** Fallback content string — used when parts is unavailable */
	content?: string;
	/** Grounded catalog surfaces the assistant referenced — rendered as citation chips. */
	catalogSources?: CatalogSource[];
	/** Original drilled nRAG chunks — rendered as a "View N sources" evidence affordance. */
	sourceChunks?: SourceChunk[];
	/** Callback when user confirms a destructive AI action */
	onconfirmaction?: (description: string) => void;
	/** Open the source-chunk viewer for this message's drilled chunks. */
	onviewchunks?: (chunks: SourceChunk[]) => void;
}

let { role, parts, content, catalogSources, sourceChunks, onconfirmaction, onviewchunks }: Props = $props();

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

/**
 * Dedupe evidence chunks by chunkId — the drill can return the same chunk
 * across steps, and a keyed list would otherwise throw each_key_duplicate.
 */
const uniqueChunks = $derived.by((): SourceChunk[] => {
	if (!sourceChunks?.length) return [];
	const seen = new Set<string>();
	const out: SourceChunk[] = [];
	for (const c of sourceChunks) {
		if (seen.has(c.chunkId)) continue;
		seen.add(c.chunkId);
		out.push(c);
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

function getToolInvocation(part: MessagePart) {
	return 'toolInvocation' in part ? (part as ToolInvocationPart).toolInvocation : null;
}
</script>

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
							<div class="chat-prose">{@html renderMarkdown(text)}</div>
						{/if}
					</div>
				{/if}
			{:else if part.type === 'tool-invocation'}
				{@const invocation = getToolInvocation(part)}
				{#if invocation}
					<ToolCallStatus
						toolName={invocation.toolName}
						phase={invocation.state}
						output={invocation.output}
					/>
					{#if invocation.state === 'result' && invocation.output && typeof invocation.output === 'object' && 'requiresConfirmation' in invocation.output}
						<ConfirmationCard
							description={(invocation.output as { description?: string }).description ?? 'Confirm this action?'}
							onconfirm={() => onconfirmaction?.((invocation.output as { description?: string }).description ?? '')}
							onskip={() => {}}
						/>
					{/if}
				{/if}
			{/if}
		{/each}

		{#if !isUser && uniqueChunks.length}
			<div class="message-sources">
				<button type="button" class="sources-btn" onclick={() => onviewchunks?.(uniqueChunks)}>
					<span class="i-lucide-file-text sources-icon" aria-hidden="true"></span>
					View {uniqueChunks.length} source{uniqueChunks.length === 1 ? '' : 's'}
				</button>
			</div>
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
	</div>
</div>

<style>
	.chat-avatar-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
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

	.message-sources {
		margin-top: 0.25rem;
	}
	.sources-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
		color: var(--color-primary);
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}
	.sources-btn:hover {
		background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
	}
	.sources-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}
	.sources-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	.chat-bubble-user {
		background-color: var(--color-primary);
	}

	.chat-bubble-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	/* === Chat prose styles === */
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

	.chat-prose :global(p) {
		margin-bottom: 0.5em;
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
		margin-bottom: 0.5em;
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
