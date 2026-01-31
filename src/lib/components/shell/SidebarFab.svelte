<script lang="ts">
	import { getSidebar } from '$lib/stores/sidebar.svelte';

	const sidebar = getSidebar();

	function handleClick() {
		sidebar.toggleMobile();
	}
</script>

<button
	class="sidebar-fab"
	onclick={handleClick}
	aria-label={sidebar.mobileOpen ? 'Close menu' : 'Open menu'}
	aria-expanded={sidebar.mobileOpen}
>
	{#if sidebar.mobileOpen}
		<!-- X icon when open -->
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="18" y1="6" x2="6" y2="18"></line>
			<line x1="6" y1="6" x2="18" y2="18"></line>
		</svg>
	{:else}
		<!-- Hamburger icon when closed -->
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="3" y1="12" x2="21" y2="12"></line>
			<line x1="3" y1="6" x2="21" y2="6"></line>
			<line x1="3" y1="18" x2="21" y2="18"></line>
		</svg>
	{/if}
</button>

<style>
	.sidebar-fab {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		background: var(--color-primary);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -1px rgb(0 0 0 / 0.06);
		z-index: var(--z-fab, 20);
		transition:
			transform var(--duration-fast, 150ms),
			box-shadow var(--duration-fast, 150ms);
	}

	.sidebar-fab:hover {
		transform: scale(1.05);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
	}

	.sidebar-fab:active {
		transform: scale(0.95);
	}

	.sidebar-fab:focus-visible {
		outline: 2px solid white;
		outline-offset: 2px;
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.sidebar-fab {
			transition: none;
		}

		.sidebar-fab:hover {
			transform: none;
		}
	}
</style>
