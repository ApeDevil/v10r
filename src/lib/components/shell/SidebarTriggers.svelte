<script lang="ts">
	/**
	 * Quick access triggers for QuickSearch + AI Assistant.
	 * Rail mode: Icon buttons
	 * Expanded mode: Fake inputs with keyboard hints
	 */

	import Icon from '@iconify/svelte';
	import { cn } from '$lib/utils/cn';
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { getModals } from '$lib/stores/modals.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
		class?: string;
	}

	let { forceExpanded = false, class: className }: Props = $props();

	const sidebar = getSidebar();
	const modals = getModals();

	const isExpanded = $derived(forceExpanded || sidebar.expanded);

	// Detect OS for keyboard hint
	const isMac =
		typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/.test(navigator.platform) : false;
	const cmdKey = isMac ? '⌘' : 'Ctrl';

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		// QuickSearch: Cmd/Ctrl + K
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			modals.open('quickSearch');
		}

		// AI Assistant: Cmd/Ctrl + J
		if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
			e.preventDefault();
			modals.open('aiAssistant');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class={cn('flex flex-col gap-2 p-2', className)}>
	{#if isExpanded}
		<!-- Expanded mode: Fake inputs with hints -->
		<button class="trigger-input flex items-center gap-2 py-[0.625rem] px-3 bg-bg border border-border rounded-md text-muted text-sm cursor-pointer transition-all duration-fast text-left w-full hover:border-primary hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none" onclick={() => modals.open('quickSearch')} aria-label="Search">
			<span class="text-[1.25rem] leading-none"><Icon icon="lucide:search" /></span>
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">Search...</span>
			<kbd class="trigger-kbd inline-flex items-center justify-center min-w-[1.5rem] h-[1.25rem] px-1 bg-border border border-muted rounded-sm text-xs font-semibold text-fg font-mono opacity-0 motion-reduce:opacity-100">{cmdKey}K</kbd>
		</button>

		<button
			class="trigger-input flex items-center gap-2 py-[0.625rem] px-3 bg-bg border border-border rounded-md text-muted text-sm cursor-pointer transition-all duration-fast text-left w-full hover:border-primary hover:bg-border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
			onclick={() => modals.open('aiAssistant')}
			aria-label="AI Assistant"
		>
			<span class="text-[1.25rem] leading-none"><Icon icon="lucide:sparkles" /></span>
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">Ask AI...</span>
			<kbd class="trigger-kbd inline-flex items-center justify-center min-w-[1.5rem] h-[1.25rem] px-1 bg-border border border-muted rounded-sm text-xs font-semibold text-fg font-mono opacity-0 motion-reduce:opacity-100">{cmdKey}J</kbd>
		</button>
	{:else}
		<!-- Rail mode: Icon buttons only -->
		<button
			class="flex items-center justify-center w-full aspect-square p-3 bg-transparent border border-border rounded-md cursor-pointer transition-all duration-fast hover:bg-border hover:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
			onclick={() => modals.open('quickSearch')}
			aria-label="Search (⌘K)"
			title="Search (⌘K)"
		>
			<span class="text-[1.25rem] leading-none"><Icon icon="lucide:search" /></span>
		</button>

		<button
			class="flex items-center justify-center w-full aspect-square p-3 bg-transparent border border-border rounded-md cursor-pointer transition-all duration-fast hover:bg-border hover:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
			onclick={() => modals.open('aiAssistant')}
			aria-label="AI Assistant (⌘J)"
			title="AI Assistant (⌘J)"
		>
			<span class="text-[1.25rem] leading-none"><Icon icon="lucide:sparkles" /></span>
		</button>
	{/if}
</div>

<style>
	/* Custom fadeIn animation */
	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	.trigger-placeholder,
	.trigger-kbd {
		animation: fadeIn var(--duration-fast) forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.trigger-placeholder,
		.trigger-kbd {
			animation: none;
			opacity: 1;
		}
	}
</style>
