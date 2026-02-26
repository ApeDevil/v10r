<script lang="ts">
	import { browser } from '$app/environment';

	interface Section {
		id: string;
		label: string;
	}

	interface Props {
		sections: Section[];
		ariaLabel?: string;
	}

	let { sections, ariaLabel = 'Section navigation' }: Props = $props();

	let sentinelEl: HTMLElement | undefined = $state();
	let chipsEl: HTMLElement | undefined = $state();
	let isStuck = $state(false);
	let activeSection = $state(sections[0]?.id ?? '');
	let canScrollRight = $state(false);
	let canScrollLeft = $state(false);
	let isUserClick = false;

	// Sentinel observer: detect when nav has scrolled to its sticky position
	$effect(() => {
		if (!browser || !sentinelEl) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				isStuck = !entry.isIntersecting;
			},
			{ threshold: 0 }
		);

		observer.observe(sentinelEl);
		return () => observer.disconnect();
	});

	// Section observer: track which section is currently visible
	$effect(() => {
		if (!browser) return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				}
			},
			{ rootMargin: '-100px 0px -66% 0px', threshold: 0 }
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	// Auto-scroll active chip into view (only on page scroll, not user click)
	$effect(() => {
		if (!browser || !chipsEl) return;
		// Track activeSection reactively
		const id = activeSection;
		if (isUserClick) return;

		const chip = chipsEl.querySelector(`[data-section="${id}"]`) as HTMLElement | null;
		chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	});

	// Track horizontal scroll overflow for fade indicators
	$effect(() => {
		if (!browser || !chipsEl) return;

		function updateOverflow() {
			if (!chipsEl) return;
			const { scrollLeft, scrollWidth, clientWidth } = chipsEl;
			canScrollLeft = scrollLeft > 1;
			canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
		}

		// Desktop: convert vertical wheel to horizontal scroll (must be non-passive to preventDefault)
		function handleWheel(e: WheelEvent) {
			if (!chipsEl || chipsEl.scrollWidth <= chipsEl.clientWidth) return;
			if (e.deltaY !== 0) {
				e.preventDefault();
				chipsEl.scrollLeft += e.deltaY;
			}
		}

		chipsEl.addEventListener('scroll', updateOverflow, { passive: true });
		chipsEl.addEventListener('wheel', handleWheel, { passive: false });
		// Also check on resize
		const ro = new ResizeObserver(updateOverflow);
		ro.observe(chipsEl);
		updateOverflow();

		return () => {
			chipsEl?.removeEventListener('scroll', updateOverflow);
			chipsEl?.removeEventListener('wheel', handleWheel);
			ro.disconnect();
		};
	});

	// Screen reader scroll position announcement
	let scrollState = $derived.by(() => {
		if (!canScrollLeft && !canScrollRight) return '';
		if (!canScrollLeft) return 'Viewing first sections, scroll right for more';
		if (!canScrollRight) return 'Viewing last sections';
		return 'More sections available in both directions';
	});

	function scrollToSection(id: string) {
		isUserClick = true;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		// Reset after scroll settles
		setTimeout(() => { isUserClick = false; }, 1000);
	}
</script>

<!-- Sentinel: zero-height marker at natural flow position -->
<div bind:this={sentinelEl} class="sentinel" aria-hidden="true"></div>

<nav class="section-nav" class:stuck={isStuck} aria-label={ariaLabel}>
	{#if scrollState}
		<div class="sr-only" role="status" aria-live="polite">{scrollState}</div>
	{/if}

	<div
		bind:this={chipsEl}
		class="nav-chips"
		class:fade-left={canScrollLeft}
		class:fade-right={canScrollRight}
	>
		{#each sections as section}
			<button
				class="nav-chip"
				class:active={activeSection === section.id}
				data-section={section.id}
				onclick={() => scrollToSection(section.id)}
				onfocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })}
				aria-current={activeSection === section.id ? 'true' : undefined}
			>
				{section.label}
			</button>
		{/each}
	</div>
</nav>

<style>
	.sentinel {
		height: 0;
		width: 100%;
		pointer-events: none;
	}

	.section-nav {
		position: sticky;
		top: 0;
		z-index: 5;
		overflow: hidden;
		background: var(--color-bg);
		border-bottom: 1px solid transparent;
		margin-inline: calc(-1 * var(--spacing-4));
		margin-bottom: var(--spacing-8);
		padding: 0 var(--spacing-4);
		transition:
			border-color var(--duration-fast),
			box-shadow var(--duration-fast),
			background var(--duration-fast);
	}

	.section-nav.stuck {
		border-bottom-color: var(--color-border);
		backdrop-filter: blur(8px);
		background: color-mix(in srgb, var(--color-bg) 85%, transparent);
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06);
	}

	.nav-chips {
		position: relative;
		display: flex;
		gap: var(--spacing-1);
		overflow-x: auto;
		padding: var(--spacing-2) var(--spacing-1);
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
		/* Fade masks for overflow indicators */
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black 100%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black 100%,
			transparent 100%
		);
	}

	.nav-chips.fade-left {
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black 100%,
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black 100%,
			transparent 100%
		);
	}

	.nav-chips.fade-right {
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black calc(100% - 32px),
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black calc(100% - 32px),
			transparent 100%
		);
	}

	.nav-chips.fade-left.fade-right {
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black calc(100% - 32px),
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black calc(100% - 32px),
			transparent 100%
		);
	}

	.nav-chip {
		flex-shrink: 0;
		padding: var(--spacing-1) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: color var(--duration-fast), background var(--duration-fast);
		white-space: nowrap;
	}

	.nav-chip:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.nav-chip.active {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.nav-chip:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (min-width: 768px) {
		.section-nav {
			margin-inline: calc(-1 * var(--spacing-7));
			padding: 0 var(--spacing-7);
		}

		.nav-chips {
			padding: var(--spacing-2) var(--spacing-1);
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	@media (max-width: 640px) {
		.section-nav {
			margin-inline: calc(-1 * var(--spacing-4));
			padding: 0 var(--spacing-4);
		}

		/* Hide scrollbar on mobile — touch scroll is natural */
		.nav-chips {
			scrollbar-width: none;
			-ms-overflow-style: none;
			/* Peek: show partial next chip as scroll affordance */
			padding-inline-end: 0;
		}

		.nav-chips::-webkit-scrollbar {
			display: none;
		}
	}
</style>
