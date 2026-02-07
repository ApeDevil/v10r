<script lang="ts">
	import { browser } from '$app/environment';
	import { showcase, getAllSections, isSectionGroup } from './_sections';
	import { getTheme } from '$lib/stores/theme.svelte';
	import { PageHeader } from '$lib/components/composites';

	const theme = getTheme();
	const allSections = getAllSections(showcase);

	let activeSection = $state(allSections[0].id);
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
		allSections.forEach((section) => {
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
			{#each showcase as entry}
				{#if isSectionGroup(entry)}
					<div class="nav-group">
						<span class="nav-group-label">{entry.label}</span>
						{#each entry.sections as section}
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
				{:else}
					<div class="nav-group">
						<button
							class="nav-item"
							class:active={activeSection === entry.id}
							onclick={() => scrollToSection(entry.id)}
							aria-current={activeSection === entry.id ? 'true' : undefined}
						>
							{entry.label}
						</button>
					</div>
				{/if}
			{/each}
		</div>
	</nav>

	<!-- Main content -->
	<main id="main-content" class="content">
		{#each allSections as section}
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
			<span class="i-lucide-sun text-icon-lg" />
		{:else}
			<span class="i-lucide-moon text-icon-lg" />
		{/if}
	</button>
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	/* Sticky section nav (sticks within page content, not globally) */
	.section-nav {
		position: sticky;
		top: 0;
		z-index: var(--z-sidebar);
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		margin: 0 calc(-1 * var(--spacing-4));
		padding: 0 var(--spacing-4);
		backdrop-filter: blur(8px);
	}

	.nav-scroll {
		display: flex;
		gap: var(--spacing-2);
		overflow-x: auto;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
		padding: var(--spacing-3) 0;
		align-items: center;
	}

	.nav-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.nav-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.nav-scroll::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: var(--radius-sm);
	}

	.nav-group {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-1);
		flex-shrink: 0;
	}

	.nav-group-label {
		flex-shrink: 0;
		padding: var(--spacing-1) var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
		user-select: none;
	}

	.nav-item {
		flex-shrink: 0;
		padding: var(--spacing-2) var(--spacing-4);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all var(--duration-fast);
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
		padding-top: var(--spacing-7);
	}

	/* Fixed theme toggle FAB */
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

	/* Desktop adjustments */
	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}

		.section-nav {
			margin: 0 calc(-1 * var(--spacing-7));
			padding: 0 var(--spacing-7);
		}

		.theme-toggle {
			top: var(--spacing-7);
			right: var(--spacing-7);
			bottom: auto;
			left: auto;
			width: 56px;
			height: 56px;
		}

		.nav-scroll {
			padding: var(--spacing-4) 0;
		}
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}

		.section-nav {
			margin: 0 calc(-1 * var(--spacing-4));
			padding: 0 var(--spacing-4);
		}
	}
</style>
