<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { PartPhoto } from '$lib/config/parts';

interface Props {
	/** Photos of the selected part (thumbnail grid → click opens the lightbox) */
	photos: PartPhoto[];
	/** Part label, used for accessible naming of the lightbox */
	partLabel: string;
}

let { photos, partLabel }: Props = $props();

// Lightbox state: index of the opened photo, or null when closed.
let lightboxIndex = $state<number | null>(null);
const lightboxPhoto = $derived(lightboxIndex === null ? null : (photos[lightboxIndex] ?? null));

// Close when the part (and thus the photo set) changes underneath us.
$effect(() => {
	void photos;
	lightboxIndex = null;
});

function step(delta: number) {
	if (lightboxIndex === null || photos.length === 0) return;
	lightboxIndex = (lightboxIndex + delta + photos.length) % photos.length;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'ArrowRight') {
		e.preventDefault();
		step(1);
	} else if (e.key === 'ArrowLeft') {
		e.preventDefault();
		step(-1);
	}
}
</script>

<div class="gallery" role="group" aria-label="{partLabel} example photos">
	{#each photos as photo, i (photo.src)}
		<button type="button" class="thumb" onclick={() => (lightboxIndex = i)} aria-label="View photo: {photo.caption}">
			<img src={photo.src} alt={photo.alt} loading="lazy" />
		</button>
	{/each}
</div>

<DialogPrimitive.Root
	open={lightboxIndex !== null}
	onOpenChange={(isOpen) => {
		if (!isOpen) lightboxIndex = null;
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-modal bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<DialogPrimitive.Content
			data-part-lightbox
			class="lightbox fixed inset-0 z-modal data-[state=open]:animate-in data-[state=closed]:animate-out"
			onkeydown={handleKeydown}
		>
			<DialogPrimitive.Title class="sr-only">{partLabel} — photo viewer</DialogPrimitive.Title>

			{#if lightboxPhoto}
				<figure class="stage">
					<img src={lightboxPhoto.src} alt={lightboxPhoto.alt} />
					<figcaption>
						<span class="caption">{lightboxPhoto.caption}</span>
						<span class="credit">{lightboxPhoto.credit}</span>
					</figcaption>
				</figure>

				{#if photos.length > 1}
					<button type="button" class="nav prev" onclick={() => step(-1)} aria-label="Previous photo">
						<span class="i-lucide-chevron-left h-6 w-6" aria-hidden="true"></span>
					</button>
					<button type="button" class="nav next" onclick={() => step(1)} aria-label="Next photo">
						<span class="i-lucide-chevron-right h-6 w-6" aria-hidden="true"></span>
					</button>
					<span class="counter" aria-live="polite">{(lightboxIndex ?? 0) + 1} / {photos.length}</span>
				{/if}

				<DialogPrimitive.Close class="close" aria-label="Close photo viewer">
					<span class="i-lucide-x h-5 w-5" aria-hidden="true"></span>
				</DialogPrimitive.Close>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
	.gallery {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-2);
	}

	.thumb {
		display: block;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: none;
		overflow: hidden;
		cursor: zoom-in;
		transition: border-color var(--duration-fast);
	}

	.thumb:hover {
		border-color: var(--color-primary);
	}

	.thumb:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.thumb img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		transition: transform var(--duration-fast);
	}

	.thumb:hover img {
		transform: scale(1.05);
	}

	:global(.lightbox) {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-6);
	}

	.stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		max-width: min(90vw, 72rem);
		max-height: 100%;
		margin: 0;
	}

	.stage img {
		max-width: 100%;
		max-height: calc(100dvh - 8rem);
		object-fit: contain;
		border-radius: var(--radius-md);
	}

	.stage figcaption {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-1);
		text-align: center;
	}

	.caption {
		color: white;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.credit {
		color: rgb(255 255 255 / 0.6);
		font-size: var(--text-fluid-xs);
	}

	.nav,
	:global(.lightbox .close) {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: var(--radius-full);
		background: rgb(0 0 0 / 0.5);
		color: white;
		cursor: pointer;
		transition: background var(--duration-fast);
	}

	.nav:hover,
	:global(.lightbox .close:hover) {
		background: rgb(0 0 0 / 0.8);
	}

	.nav:focus-visible,
	:global(.lightbox .close:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.nav.prev {
		left: var(--spacing-4);
		top: 50%;
		transform: translateY(-50%);
	}

	.nav.next {
		right: var(--spacing-4);
		top: 50%;
		transform: translateY(-50%);
	}

	:global(.lightbox .close) {
		top: var(--spacing-4);
		right: var(--spacing-4);
	}

	.counter {
		position: absolute;
		bottom: var(--spacing-4);
		left: 50%;
		transform: translateX(-50%);
		color: rgb(255 255 255 / 0.7);
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
	}
</style>
