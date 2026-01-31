<script lang="ts">
	/**
	 * Logo/branding for sidebar.
	 * Rail mode: Icon only (collapsed)
	 * Expanded mode: Icon + text
	 */

	import { getSidebar } from '$lib/stores/sidebar.svelte';

	interface Props {
		forceExpanded?: boolean; // Force expanded mode (for drawer)
	}

	let { forceExpanded = false }: Props = $props();

	const sidebar = getSidebar();

	const showText = $derived(forceExpanded || sidebar.expanded);
</script>

<a href="/" class="sidebar-logo" aria-label="Home">
	<div class="logo-icon">🦖</div>
	{#if showText}
		<span class="logo-text">Velociraptor</span>
	{/if}
</a>

<style>
	.sidebar-logo {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		text-decoration: none;
		border-radius: 0.375rem;
		transition: background var(--duration-fast, 150ms);
	}

	.sidebar-logo:hover {
		background: var(--color-border);
	}

	.sidebar-logo:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.logo-icon {
		font-size: 2rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.logo-text {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--color-fg);
		white-space: nowrap;
		opacity: 0;
		animation: fadeIn var(--duration-fast, 150ms) forwards;
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.sidebar-logo {
			transition: none;
		}

		.logo-text {
			animation: none;
			opacity: 1;
		}
	}
</style>
