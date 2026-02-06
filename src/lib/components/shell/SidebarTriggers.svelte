<script lang="ts">
	/**
	 * Quick access triggers for QuickSearch + AI Assistant.
	 * Persistent buttons that transition between rail (icon-only) and expanded (fake input) modes.
	 * Icons stay mounted across expand/collapse to prevent DOM swap jank.
	 */

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
	<button
		type="button"
		class={cn(
			'flex items-center rounded-md text-muted cursor-pointer transition-all duration-fast motion-reduce:transition-none',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'trigger-input h-10 gap-2 px-2 bg-bg border border-border text-sm text-left w-full hover:border-primary hover:bg-border'
				: 'h-10 w-10 justify-center border-none bg-transparent hover:bg-border hover:text-fg'
		)}
		onclick={() => modals.open('quickSearch')}
		aria-label={isExpanded ? 'Search' : 'Search (⌘K)'}
		title={isExpanded ? undefined : 'Search (⌘K)'}
	>
		<span class="i-lucide-search text-icon-md shrink-0" />
		{#if isExpanded}
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">Search...</span>
			<kbd
				class="trigger-kbd inline-flex items-center justify-center min-w-[1.5rem] h-[1.25rem] px-1 bg-border border border-muted rounded-sm text-xs font-semibold text-fg font-mono opacity-0 motion-reduce:opacity-100"
				>{cmdKey}K</kbd
			>
		{/if}
	</button>

	<button
		type="button"
		class={cn(
			'flex items-center rounded-md text-muted cursor-pointer transition-all duration-fast motion-reduce:transition-none',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'trigger-input h-10 gap-2 px-2 bg-bg border border-border text-sm text-left w-full hover:border-primary hover:bg-border'
				: 'h-10 w-10 justify-center border-none bg-transparent hover:bg-border hover:text-fg'
		)}
		onclick={() => modals.open('aiAssistant')}
		aria-label={isExpanded ? 'AI Assistant' : 'AI Assistant (⌘J)'}
		title={isExpanded ? undefined : 'AI Assistant (⌘J)'}
	>
		<span class="i-lucide-sparkles text-icon-md shrink-0" />
		{#if isExpanded}
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">Ask AI...</span>
			<kbd
				class="trigger-kbd inline-flex items-center justify-center min-w-[1.5rem] h-[1.25rem] px-1 bg-border border border-muted rounded-sm text-xs font-semibold text-fg font-mono opacity-0 motion-reduce:opacity-100"
				>{cmdKey}J</kbd
			>
		{/if}
	</button>
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
