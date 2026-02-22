<script lang="ts">
	interface Props {
		value: string;
		loading?: boolean;
		onsubmit: () => void;
	}

	let { value = $bindable(''), loading = false, onsubmit }: Props = $props();

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
	<button
		type="button"
		onclick={onsubmit}
		disabled={loading || !value.trim()}
		class="chat-send-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white disabled:opacity-40"
		aria-label="Send message"
	>
		{#if loading}
			<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
		{:else}
			<span class="i-lucide-send h-4 w-4"></span>
		{/if}
	</button>
</div>

<style>
	.chat-textarea {
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	.chat-textarea:focus {
		background-color: transparent;
	}

	.chat-send-btn {
		transition:
			translate var(--duration-fast) var(--ease-out),
			box-shadow var(--duration-fast) var(--ease-default);
	}

	.chat-send-btn:not(:disabled):hover {
		translate: 0 -2px;
		box-shadow: 0 0 16px 4px color-mix(in srgb, var(--color-primary) 45%, transparent);
	}

	.chat-send-btn:not(:disabled):active {
		translate: 0 0;
		box-shadow: none;
	}
</style>
