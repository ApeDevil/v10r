<script lang="ts">
	import { Button } from '$lib/components/primitives';
	import { ScrollArea } from '$lib/components/primitives/scroll-area';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/** Pre-highlighted HTML from Shiki */
		highlightedHtml?: string;
		/** Raw code text (fallback when no highlighted HTML) */
		code?: string;
		/** Language label */
		language?: string;
		/** Optional filename */
		filename?: string;
		class?: string;
	}

	let { highlightedHtml, code, language, filename, class: className }: Props = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	function getRawCode(): string {
		if (code) return code;
		if (highlightedHtml) {
			const div = document.createElement('div');
			div.innerHTML = highlightedHtml;
			return div.textContent ?? '';
		}
		return '';
	}

	async function handleCopy() {
		if (!navigator?.clipboard) return;
		await navigator.clipboard.writeText(getRawCode());
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class={cn('code-block', className)}>
	<div class="code-header">
		<span class="code-label">
			{#if filename}
				<span class="i-lucide-file-code h-3.5 w-3.5" aria-hidden="true"></span>
				{filename}
			{:else if language}
				{language}
			{/if}
		</span>
		<Button variant="ghost" size="icon" class="copy-btn" onclick={handleCopy} aria-label="Copy code">
			{#if copied}
				<span class="i-lucide-check h-3.5 w-3.5 text-green-500" aria-hidden="true"></span>
			{:else}
				<span class="i-lucide-copy h-3.5 w-3.5" aria-hidden="true"></span>
			{/if}
		</Button>
	</div>
	<ScrollArea orientation="horizontal" class="code-scroll">
		{#if highlightedHtml}
			<div class="code-content highlighted">
				{@html highlightedHtml}
			</div>
		{:else if code}
			<pre class="code-content plain"><code>{code}</code></pre>
		{/if}
	</ScrollArea>
</div>

<style>
	.code-block {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.code-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.code-label {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
		font-family: var(--font-mono, monospace);
	}

	.code-header :global(.copy-btn) {
		width: 1.75rem;
		height: 1.75rem;
	}

	.code-content {
		padding: var(--spacing-4);
		overflow-x: auto;
	}

	.code-content.highlighted :global(pre) {
		margin: 0;
		padding: 0;
		background: transparent !important;
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		tab-size: 2;
	}

	.code-content.highlighted :global(code) {
		font-family: inherit;
	}

	.code-content.plain {
		margin: 0;
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-fg);
		background: transparent;
		tab-size: 2;
		white-space: pre;
	}

	.code-content.plain code {
		font-family: inherit;
	}

	:global(.code-scroll) {
		background: var(--color-subtle);
	}
</style>
