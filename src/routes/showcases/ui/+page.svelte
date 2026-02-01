<script lang="ts">
	import { browser } from '$app/environment';
	import { sections } from './_sections';
	import { getTheme } from '$lib/stores/theme.svelte';
	import { PageHeader } from '$lib/components/composites';
	import Icon from '@iconify/svelte';

	const theme = getTheme();

	let activeSection = $state(sections[0].id);
	let navContainer: HTMLElement;
	let sectionRefs: Map<string, HTMLElement> = new Map();

	// Intersection Observer to track active section
	$effect(() => {
		if (!browser) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				});
			},
			{
				rootMargin: '-100px 0px -66% 0px',
				threshold: 0
			}
		);

		// Observe all sections
		sections.forEach((section) => {
			const element = document.getElementById(section.id);
			if (element) {
				sectionRefs.set(section.id, element);
				observer.observe(element);
			}
		});

		return () => observer.disconnect();
	});

	function scrollToSection(sectionId: string) {
		const element = document.getElementById(sectionId);
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function toggleTheme() {
		theme.setMode(theme.isDark ? 'light' : 'dark');
	}
</script>

<svelte:head>
	<title>UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<!-- Page header with breadcrumbs (not sticky, inside content) -->
	<PageHeader
		title="UI Showcase"
		description="Explore all UI components, design tokens, and patterns used in Velociraptor."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI' }
		]}
	/>

	<!-- Section nav (sticky within content area) -->
	<nav bind:this={navContainer} class="section-nav" aria-label="Section navigation">
		<div class="nav-scroll">
			{#each sections as section}
				<button
					class="nav-item"
					class:active={activeSection === section.id}
					onclick={() => scrollToSection(section.id)}
					aria-current={activeSection === section.id ? 'true' : undefined}
				>
					{section.label}
				</button>
			{/each}
		</div>
	</nav>

	<!-- Main content -->
	<main id="main-content" class="content">
		{#each sections as section}
			{@const SectionComponent = section.component}
			<SectionComponent />
		{/each}
	</main>

	<!-- Fixed theme toggle FAB -->
	<button
		class="theme-toggle"
		onclick={toggleTheme}
		aria-label="Toggle theme"
		title="Toggle theme"
	>
		{#if theme.isDark}
			<Icon icon="lucide:sun" width="24" height="24" />
		{:else}
			<Icon icon="lucide:moon" width="24" height="24" />
		{/if}
	</button>
</div>

<style>
	.page {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
		box-sizing: border-box;
	}

	/* Sticky section nav (sticks within page content, not globally) */
	.section-nav {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		margin: 0 -1rem;
		padding: 0 1rem;
		backdrop-filter: blur(8px);
	}

	.nav-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
		padding: 0.75rem 0;
	}

	.nav-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.nav-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 2px;
	}

	.nav-item {
		flex-shrink: 0;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-muted);
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.nav-item:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.nav-item.active {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.nav-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Main content */
	.content {
		padding-top: 2rem;
	}

	/* Fixed theme toggle FAB */
	.theme-toggle {
		position: fixed;
		top: 1.5rem;
		right: 1.5rem;
		z-index: 20;
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 50%;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		cursor: pointer;
		transition: all 0.2s;
	}

	.theme-toggle:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.theme-toggle:active {
		transform: scale(0.95);
	}

	.theme-toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Desktop adjustments */
	@media (min-width: 768px) {
		.page {
			padding: 2rem;
		}

		.section-nav {
			margin: 0 -2rem;
			padding: 0 2rem;
		}

		.theme-toggle {
			top: 2rem;
			right: 2rem;
		}

		.nav-scroll {
			padding: 1rem 0;
		}
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.page {
			padding: 1rem;
		}

		.section-nav {
			margin: 0 -1rem;
			padding: 0 1rem;
		}
	}
</style>
