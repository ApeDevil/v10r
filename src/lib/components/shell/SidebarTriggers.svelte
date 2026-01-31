<script lang="ts">
	/**
	 * Quick access triggers for QuickSearch + AI Assistant.
	 * Rail mode: Icon buttons
	 * Expanded mode: Fake inputs with keyboard hints
	 */

	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { getModals } from '$lib/stores/modals.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
	}

	let { forceExpanded = false }: Props = $props();

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

<div class="sidebar-triggers">
	{#if isExpanded}
		<!-- Expanded mode: Fake inputs with hints -->
		<button class="trigger-input" onclick={() => modals.open('quickSearch')} aria-label="Search">
			<span class="trigger-icon">🔍</span>
			<span class="trigger-placeholder">Search...</span>
			<kbd class="trigger-kbd">{cmdKey}K</kbd>
		</button>

		<button
			class="trigger-input"
			onclick={() => modals.open('aiAssistant')}
			aria-label="AI Assistant"
		>
			<span class="trigger-icon">✨</span>
			<span class="trigger-placeholder">Ask AI...</span>
			<kbd class="trigger-kbd">{cmdKey}J</kbd>
		</button>
	{:else}
		<!-- Rail mode: Icon buttons only -->
		<button
			class="trigger-button"
			onclick={() => modals.open('quickSearch')}
			aria-label="Search (⌘K)"
			title="Search (⌘K)"
		>
			<span class="trigger-icon">🔍</span>
		</button>

		<button
			class="trigger-button"
			onclick={() => modals.open('aiAssistant')}
			aria-label="AI Assistant (⌘J)"
			title="AI Assistant (⌘J)"
		>
			<span class="trigger-icon">✨</span>
		</button>
	{/if}
</div>

<style>
	.sidebar-triggers {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
	}

	/* Expanded mode: Fake input */
	.trigger-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		color: var(--color-muted);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms);
		text-align: left;
		width: 100%;
	}

	.trigger-input:hover {
		border-color: var(--color-primary);
		background: var(--color-border);
	}

	.trigger-input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.trigger-placeholder {
		flex: 1;
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	.trigger-kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		background: var(--color-border);
		border: 1px solid var(--color-muted);
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-fg);
		font-family: ui-monospace, monospace;
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	/* Rail mode: Icon button */
	.trigger-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		aspect-ratio: 1;
		padding: 0.75rem;
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all var(--duration-fast, 150ms);
	}

	.trigger-button:hover {
		background: var(--color-border);
		border-color: var(--color-primary);
	}

	.trigger-button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.trigger-icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.trigger-input,
		.trigger-button {
			transition: none;
		}

		.trigger-placeholder,
		.trigger-kbd {
			animation: none;
			opacity: 1;
		}
	}
</style>
