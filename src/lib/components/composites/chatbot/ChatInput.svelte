<script lang="ts">
import { Button } from '$lib/components/primitives/button';

interface Props {
	value: string;
	loading?: boolean;
	contextCount?: number;
	onsubmit: () => void;
	onopensettings?: () => void;
}

let { value = $bindable(''), loading = false, contextCount = 0, onsubmit, onopensettings }: Props = $props();

let textarea: HTMLTextAreaElement | undefined = $state();

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		if (value.trim() && !loading) {
			onsubmit();
		}
	}
}

/** Auto-resize textarea to fit content */
function autoResize() {
	if (!textarea) return;
	textarea.style.height = 'auto';
	textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
}

$effect(() => {
	// Reset height when value is cleared
	if (!value && textarea) {
		textarea.style.height = 'auto';
	}
});
</script>

<div class="chat-input-container flex items-end gap-2 border-t border-border p-3">
	{#if onopensettings}
		<Button
			variant="ghost"
			size="icon"
			onclick={onopensettings}
			class="settings-btn"
			aria-label="Bot manager settings"
		>
			<span class="i-lucide-sliders-horizontal settings-icon"></span>
			{#if contextCount > 0}
				<span class="context-badge">{contextCount}</span>
			{/if}
		</Button>
	{/if}

	<textarea
		bind:this={textarea}
		bind:value
		oninput={autoResize}
		onkeydown={handleKeydown}
		placeholder="Type a message..."
		disabled={loading}
		rows={1}
		class="chat-textarea flex-1 resize-none rounded-md border border-border px-3 py-2 text-fluid-base text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
	></textarea>
	<Button
		variant="primary"
		size="icon"
		onclick={onsubmit}
		disabled={loading || !value.trim()}
		class="shrink-0"
		aria-label="Send message"
	>
		{#if loading}
			<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
		{:else}
			<span class="i-lucide-send h-4 w-4"></span>
		{/if}
	</Button>
</div>

<style>
	.chat-textarea {
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	.chat-textarea:focus {
		background-color: transparent;
	}

	:global(.settings-btn) {
		position: relative;
		color: var(--color-muted);
	}

	.settings-icon {
		font-size: 16px;
	}

	.context-badge {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		font-size: 10px;
		font-weight: 600;
		line-height: 16px;
		text-align: center;
		background: var(--color-primary);
		color: white;
	}

</style>
