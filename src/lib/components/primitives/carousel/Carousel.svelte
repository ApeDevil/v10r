<script lang="ts">
import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';
import {
	type CarouselRootVariants,
	carouselButtonVariants,
	carouselContentVariants,
	carouselDotsVariants,
	carouselDotVariants,
	carouselItemVariants,
	carouselRootVariants,
} from './carousel';

interface Props extends CarouselRootVariants {
	children: Snippet;
	class?: string;
	loop?: boolean;
	autoplay?: boolean;
	autoplayInterval?: number;
	showDots?: boolean;
	showArrows?: boolean;
}

let {
	children,
	orientation = 'horizontal',
	loop = true,
	autoplay = false,
	autoplayInterval = 3000,
	showDots = true,
	showArrows = true,
	class: className,
}: Props = $props();

let scrollContainer = $state<HTMLDivElement | null>(null);
let slides = $state<HTMLElement[]>([]);
let currentSlide = $state(0);
let isHovering = $state(false);
let isPlaying = $state(true);
let autoplayTimer: ReturnType<typeof setInterval> | null = null;

// Track active slide using IntersectionObserver
$effect(() => {
	if (typeof window === 'undefined' || !scrollContainer) return;

	const slideElements = Array.from(scrollContainer.children) as HTMLElement[];
	slides = slideElements;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const index = slides.indexOf(entry.target as HTMLElement);
					if (index !== -1) {
						currentSlide = index;
					}
				}
			});
		},
		{
			root: scrollContainer,
			threshold: 0.5,
		},
	);

	for (const slide of slideElements) observer.observe(slide);

	return () => observer.disconnect();
});

// Autoplay functionality
$effect(() => {
	if (!autoplay || !isPlaying || isHovering || !scrollContainer) {
		if (autoplayTimer) {
			clearInterval(autoplayTimer);
			autoplayTimer = null;
		}
		return;
	}

	autoplayTimer = setInterval(() => {
		goToNext();
	}, autoplayInterval);

	return () => {
		if (autoplayTimer) {
			clearInterval(autoplayTimer);
		}
	};
});

// Navigate to specific slide
function goToSlide(index: number) {
	if (!scrollContainer || !slides[index]) return;

	const slide = slides[index];
	const scrollProperty = orientation === 'horizontal' ? 'scrollLeft' : 'scrollTop';
	const offsetProperty = orientation === 'horizontal' ? 'offsetLeft' : 'offsetTop';

	scrollContainer[scrollProperty] = slide[offsetProperty];
}

// Navigate to previous slide
function goToPrev() {
	const prevIndex = currentSlide - 1;
	if (prevIndex < 0) {
		if (loop) {
			goToSlide(slides.length - 1);
		}
	} else {
		goToSlide(prevIndex);
	}
}

// Navigate to next slide
function goToNext() {
	const nextIndex = currentSlide + 1;
	if (nextIndex >= slides.length) {
		if (loop) {
			goToSlide(0);
		}
	} else {
		goToSlide(nextIndex);
	}
}

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
	if (orientation === 'horizontal') {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			goToPrev();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			goToNext();
		}
	} else {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			goToPrev();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			goToNext();
		}
	}
}

// Toggle autoplay
function toggleAutoplay() {
	isPlaying = !isPlaying;
}

// Check if navigation buttons should be disabled
const canGoPrev = $derived(loop || currentSlide > 0);
const canGoNext = $derived(loop || currentSlide < slides.length - 1);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={cn(carouselRootVariants({ orientation }), className)}
	onmouseenter={() => (isHovering = true)}
	onmouseleave={() => (isHovering = false)}
	onkeydown={handleKeydown}
	role="region"
	aria-roledescription="carousel"
	aria-label={m.primitives_carousel_label()}
>
	<div
		bind:this={scrollContainer}
		class={cn(carouselContentVariants({ orientation }))}
		role="list"
	>
		{@render children()}
	</div>

	{#if showArrows}
		<button
			class={cn(carouselButtonVariants({ orientation, direction: 'prev' }))}
			onclick={goToPrev}
			disabled={!canGoPrev}
			aria-label={m.primitives_carousel_previous()}
			type="button"
		>
			{#if orientation === 'horizontal'}
				<div class="i-lucide-chevron-left h-5 w-5" aria-hidden="true"></div>
			{:else}
				<div class="i-lucide-chevron-up h-5 w-5" aria-hidden="true"></div>
			{/if}
		</button>

		<button
			class={cn(carouselButtonVariants({ orientation, direction: 'next' }))}
			onclick={goToNext}
			disabled={!canGoNext}
			aria-label={m.primitives_carousel_next()}
			type="button"
		>
			{#if orientation === 'horizontal'}
				<div class="i-lucide-chevron-right h-5 w-5" aria-hidden="true"></div>
			{:else}
				<div class="i-lucide-chevron-down h-5 w-5" aria-hidden="true"></div>
			{/if}
		</button>
	{/if}

	{#if showDots && slides.length > 0}
		<div class={cn(carouselDotsVariants({ orientation }), 'relative')} role="tablist" aria-label={m.primitives_carousel_indicators()}>
			{#each slides as _, index}
				<button
					class={cn(carouselDotVariants({ active: index === currentSlide }))}
					onclick={() => goToSlide(index)}
					role="tab"
					aria-label={m.primitives_carousel_go_to_slide({ index: index + 1 })}
					aria-selected={index === currentSlide}
					aria-controls="carousel-slide-{index}"
					type="button"
				></button>
			{/each}

			{#if autoplay}
				<button
					class={cn(
						'ml-2 inline-flex items-center justify-center',
						'h-6 w-6 rounded-full',
						'carousel-autoplay-btn',
						'border border-border',
						'transition-colors duration-fast',
						'hover:bg-surface-3 hover:text-fg',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
					)}
					onclick={toggleAutoplay}
					aria-label={isPlaying ? m.primitives_carousel_pause_autoplay() : m.primitives_carousel_resume_autoplay()}
					type="button"
				>
					<div class={cn(isPlaying ? 'i-lucide-pause' : 'i-lucide-play', 'h-3 w-3')} aria-hidden="true"></div>
				</button>
			{/if}
		</div>
	{/if}

	<!-- Live region for screen reader slide announcements -->
	{#if slides.length > 0}
		<div class="sr-only" aria-live="polite" aria-atomic="true">
			{m.primitives_carousel_slide_status({ current: currentSlide + 1, total: slides.length })}
		</div>
	{/if}
</div>

<style>
	/* Hide scrollbar but keep functionality */
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}

	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	/* UnoCSS can't apply opacity modifiers to CSS custom property colors */
	.carousel-autoplay-btn {
		background-color: color-mix(in srgb, var(--color-surface-3) 80%, transparent);
		color: color-mix(in srgb, var(--color-fg) 70%, transparent);
	}
</style>
