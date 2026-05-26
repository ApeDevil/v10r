<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { Button } from '$lib/components/primitives';
	import type { GalleryCardCta, GalleryCardItem } from './gallery-card';

	interface Props {
		items: GalleryCardItem[];
		title: string;
		text?: string;
		syncText?: boolean;
		autoplay?: boolean;
		autoplayInterval?: number;
		cta?: GalleryCardCta;
		class?: string;
	}

	let {
		items,
		title,
		text,
		syncText = false,
		autoplay = false,
		autoplayInterval = 4000,
		cta,
		class: className,
	}: Props = $props();

	let activeIndex = $state(0);
	let paused = $state(false);
	let hovering = $state(false);
	let focusWithin = $state(false);
	let restartKey = $state(0);

	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	const activeItem = $derived(items[activeIndex]);
	const displayTitle = $derived(syncText && activeItem?.title ? activeItem.title : title);
	const displayText = $derived(syncText && activeItem?.text != null ? activeItem.text : text);

	function select(i: number) {
		activeIndex = i;
		restartKey++;
	}

	function handleThumbKeydown(event: KeyboardEvent, i: number) {
		let next = i;
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			next = (i + 1) % items.length;
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			next = (i - 1 + items.length) % items.length;
		} else if (event.key === 'Home') {
			event.preventDefault();
			next = 0;
		} else if (event.key === 'End') {
			event.preventDefault();
			next = items.length - 1;
		} else {
			return;
		}
		select(next);
		// Move focus to the newly active thumb
		const strip = (event.currentTarget as HTMLElement).closest('.thumb-strip');
		const buttons = strip?.querySelectorAll<HTMLButtonElement>('button[type="button"]');
		buttons?.[next]?.focus();
	}

	$effect(() => {
		// Track restartKey so manual selection restarts the timer
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		restartKey;

		if (!autoplay || paused || hovering || focusWithin || reduceMotion.current || items.length <= 1) {
			return;
		}

		const id = setInterval(() => {
			activeIndex = (activeIndex + 1) % items.length;
		}, autoplayInterval);

		return () => clearInterval(id);
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	class="gallery-card {className ?? ''}"
	onmouseenter={() => (hovering = true)}
	onmouseleave={() => (hovering = false)}
	onfocusin={() => (focusWithin = true)}
	onfocusout={() => (focusWithin = false)}
	aria-label={displayTitle}
>
	<!-- sr-only live region -->
	<div class="sr-only" aria-live="polite">
		{`Image ${activeIndex + 1} of ${items.length}`}
	</div>

	<!-- Media column -->
	<div class="media-col">
		<!-- Main image -->
		<div class="main-image-wrapper">
			<img
				class="main-image"
				src={activeItem.src}
				alt={activeItem.alt}
			/>
			{#if autoplay}
				<button
					type="button"
					class="play-pause-btn"
					aria-label={paused ? 'Resume image rotation' : 'Pause image rotation'}
					onclick={() => (paused = !paused)}
				>
					<span class={paused ? 'i-lucide-play' : 'i-lucide-pause'} aria-hidden="true"></span>
				</button>
			{/if}
		</div>

		<!-- Thumbnail strip -->
		{#if items.length > 1}
			<div class="thumb-strip" role="group" aria-label="Image thumbnails">
				{#each items as item, i}
					<button
						type="button"
						class="thumb-btn"
						class:thumb-active={i === activeIndex}
						aria-label={`Show image ${i + 1}: ${item.alt}`}
						aria-pressed={i === activeIndex}
						tabindex={i === activeIndex ? 0 : -1}
						onclick={() => select(i)}
						onkeydown={(e) => handleThumbKeydown(e, i)}
					>
						<img
							class="thumb-img"
							src={item.thumb ?? item.src}
							alt=""
							aria-hidden="true"
						/>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Text column -->
	<div class="text-col">
		<h3 class="card-title">{displayTitle}</h3>
		{#if displayText}
			<p class="card-text">{displayText}</p>
		{/if}
		{#if cta}
			<div class="cta-wrapper">
				{#if cta.href}
					<Button href={cta.href} variant="default">
						{cta.label}
					</Button>
				{:else}
					<Button onclick={cta.onclick} variant="default">
						{cta.label}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
</section>

<style>
	.gallery-card {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
		padding: 0;
		/* overflow:hidden + the radius clips the full-bleed media to the card corners */
		overflow: hidden;
		background-color: var(--surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	@media (min-width: 768px) {
		.gallery-card {
			/* media gets more weight than text — keeps text near a readable measure */
			grid-template-columns: 3fr 2fr;
			align-items: start;
		}
	}

	/* ── Media column ──────────────────────────────────── */

	.media-col {
		display: flex;
		flex-direction: column;
		/* no gap — the thumb strip's own padding separates it from the image */
		gap: 0;
	}

	.main-image-wrapper {
		position: relative;
		aspect-ratio: 16 / 9;
		/* no radius — the card's overflow:hidden clips the corners */
		border-radius: 0;
		overflow: hidden;
		background-color: var(--color-subtle);
	}

	.main-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── Pause / Play overlay ──────────────────────────── */

	.play-pause-btn {
		position: absolute;
		bottom: var(--spacing-2);
		right: var(--spacing-2);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-full);
		border: none;
		cursor: pointer;
		background-color: color-mix(in srgb, var(--color-bg) 75%, transparent);
		color: var(--color-fg);
		transition: background-color 150ms;
	}

	.play-pause-btn:hover {
		background-color: color-mix(in srgb, var(--color-bg) 90%, transparent);
	}

	.play-pause-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* ── Thumbnail strip ───────────────────────────────── */

	.thumb-strip {
		display: flex;
		flex-direction: row;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		overflow-x: auto;
		scrollbar-width: none;
		background-color: var(--surface-1);
	}

	.thumb-strip::-webkit-scrollbar {
		display: none;
	}

	.thumb-btn {
		flex-shrink: 0;
		width: 4rem;
		height: 4rem;
		padding: 0;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-border);
		cursor: pointer;
		overflow: hidden;
		background: none;
		opacity: 0.75;
		transition: opacity 150ms, border-color 150ms;
	}

	.thumb-btn:hover {
		opacity: 1;
	}

	.thumb-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		opacity: 1;
	}

	.thumb-btn.thumb-active {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 35%, transparent);
		opacity: 1;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* ── Text column ───────────────────────────────────── */

	.text-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		/* card padding lives here — media is full-bleed, so only text is inset */
		padding: var(--spacing-5);
	}

	.card-title {
		margin: 0;
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		color: var(--color-fg);
		line-height: 1.25;
	}

	.card-text {
		margin: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.cta-wrapper {
		margin-top: var(--spacing-2);
	}

	/* ── Accessibility ─────────────────────────────────── */

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

	@media (prefers-reduced-motion: reduce) {
		.thumb-btn,
		.play-pause-btn {
			transition: none;
		}
	}
</style>
