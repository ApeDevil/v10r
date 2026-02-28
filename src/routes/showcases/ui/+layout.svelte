<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getTheme } from '$lib/state/theme.svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();
	const theme = getTheme();

	function toggleTheme() {
		theme.setMode(theme.isDark ? 'light' : 'dark');
	}

	const tabs = [
		{ label: 'Components', href: '/showcases/ui/components' },
		{ label: 'Layouts', href: '/showcases/ui/layouts' },
		{ label: 'Tables', href: '/showcases/ui/tables' },
		{ label: 'Panes', href: '/showcases/ui/panes' },
		{ label: 'Decorative', href: '/showcases/ui/decorative' },
		{ label: 'Typography', href: '/showcases/ui/typography' },
		{ label: 'Tokens', href: '/showcases/ui/tokens' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="UI Showcase"
		description="Explore all UI components, design tokens, and patterns used in Velociraptor."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI' }
		]}
	/>

	<TabNav {tabs} ariaLabel="UI sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>

<!-- Fixed theme toggle FAB -->
<button
	class="theme-toggle"
	onclick={toggleTheme}
	aria-label="Toggle theme"
	title="Toggle theme"
>
	{#if theme.isDark}
		<span class="i-lucide-sun text-icon-lg" />
	{:else}
		<span class="i-lucide-moon text-icon-lg" />
	{/if}
</button>

<style>
	.theme-toggle {
		position: fixed;
		bottom: var(--spacing-8);
		left: var(--spacing-4);
		z-index: var(--z-fab);
		width: var(--spacing-8);
		height: var(--spacing-8);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
		color: var(--color-bg);
		border: none;
		border-radius: var(--radius-full);
		box-shadow: var(--shadow-lg);
		cursor: pointer;
		transition: all var(--duration-fast);
	}

	.theme-toggle:hover {
		transform: scale(1.1);
		box-shadow: var(--shadow-xl);
	}

	.theme-toggle:active {
		transform: scale(0.95);
	}

	.theme-toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (min-width: 768px) {
		.theme-toggle {
			top: var(--spacing-7);
			right: var(--spacing-7);
			bottom: auto;
			left: auto;
			width: 56px;
			height: 56px;
		}
	}
</style>
