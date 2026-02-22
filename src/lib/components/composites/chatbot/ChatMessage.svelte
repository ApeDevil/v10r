<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { renderMarkdown } from '$lib/utils/markdown';

	interface Props {
		role: 'user' | 'assistant';
		content: string;
	}

	let { role, content }: Props = $props();

	const isUser = $derived(role === 'user');
	const htmlContent = $derived(!isUser ? renderMarkdown(content) : '');
</script>

<div class={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
	<div
		class={cn(
			'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
			isUser ? 'bg-primary text-white' : 'chat-avatar-assistant'
		)}
	>
		<span class={cn(isUser ? 'i-lucide-user' : 'i-lucide-bot', 'h-4 w-4')}></span>
	</div>

	<div
		class={cn(
			'chat-bubble max-w-[80%] rounded-lg px-4 py-2 text-fluid-sm',
			isUser ? 'chat-bubble-user text-white' : 'chat-bubble-assistant text-fg'
		)}
	>
		{#if isUser}
			<p class="whitespace-pre-wrap">{content}</p>
		{:else}
			<div class="chat-prose">{@html htmlContent}</div>
		{/if}
	</div>
</div>

<style>
	.chat-avatar-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
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
