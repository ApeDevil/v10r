<script lang="ts">
	import { browser } from '$app/environment';
	import { PageHeader, BackLink } from '$lib/components/composites';
	import FeedbackSection from '../_sections/FeedbackSection.svelte';
	import ContentSection from '../_sections/ContentSection.svelte';
	import NavigationSection from '../_sections/NavigationSection.svelte';
	import FormsSection from '../_sections/FormsSection.svelte';

	const sections = [
		{ id: 'comp-feedback', label: 'Feedback' },
		{ id: 'comp-content', label: 'Content' },
		{ id: 'comp-navigation', label: 'Navigation' },
		{ id: 'comp-forms', label: 'Forms' }
	];

	let activeSection = $state(sections[0].id);

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
			{ rootMargin: '-100px 0px -66% 0px', threshold: 0 }
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	function scrollToSection(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>Composites - UI Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Composites"
		description="Alerts, toasts, cards, navigation, pagination, and form patterns."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'UI', href: '/showcases/ui' },
			{ label: 'Composites' }
		]}
	/>

	<nav class="section-nav" aria-label="Section navigation">
		<div class="nav-chips">
			{#each sections as section}
				<button
					class="nav-chip"
					class:active={activeSection === section.id}
					onclick={() => scrollToSection(section.id)}
					aria-current={activeSection === section.id ? 'true' : undefined}
				>
					{section.label}
				</button>
			{/each}
		</div>
	</nav>

	<main class="content">
		<FeedbackSection />
		<ContentSection />
		<NavigationSection />
		<FormsSection />
	</main>

	<BackLink href="/showcases/ui" label="UI" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

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

	.nav-chips {
		display: flex;
		gap: var(--spacing-2);
		overflow-x: auto;
		padding: var(--spacing-3) 0;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.nav-chip {
		flex-shrink: 0;
		padding: var(--spacing-2) var(--spacing-4);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all var(--duration-fast);
		white-space: nowrap;
	}

	.nav-chip:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.nav-chip.active {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-color: var(--color-primary);
	}

	.nav-chip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.content {
		padding-top: var(--spacing-7);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}

		.section-nav {
			margin: 0 calc(-1 * var(--spacing-7));
			padding: 0 var(--spacing-7);
		}

		.nav-chips {
			padding: var(--spacing-4) 0;
		}
	}

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
