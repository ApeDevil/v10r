<script lang="ts">
import type { GalleryCardItem } from '$lib/components';
import { GalleryCard } from '$lib/components';
import { DemoCard } from '../_components';

// ── Offline SVG placeholder helpers ──────────────────────────────────────
// bg values are pixel data inside generated SVG images — literal colors here
// are unavoidable for image fixture data and are NOT component/section CSS.
const slide = (label: string, bg: string): string =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='${bg}'/><text x='200' y='160' font-family='sans-serif' font-size='32' fill='white' text-anchor='middle'>${label}</text></svg>`,
	)}`;

// Animated SVG: bouncing circle (SMIL) — proves <img> renders animations
const animated: string = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#1e3a8a'/><circle cy='150' r='40' fill='#f59e0b'><animate attributeName='cx' values='60;340;60' dur='2s' repeatCount='indefinite'/></circle></svg>`,
)}`;

// ── Demo A: fixed copy, 4 items ──────────────────────────────────────────
const itemsFixed: GalleryCardItem[] = [
	{ src: slide('Alpine', '#2563eb'), alt: 'Alpine mountain landscape' },
	{ src: slide('Forest', '#16a34a'), alt: 'Dense green forest' },
	{ src: slide('Desert', '#d97706'), alt: 'Sandy desert dunes' },
	{ src: slide('Ocean', '#0891b2'), alt: 'Deep blue ocean' },
];

// ── Demo B: synced copy, 3 items ─────────────────────────────────────────
const itemsSynced: GalleryCardItem[] = [
	{
		src: slide('Model A', '#7c3aed'),
		alt: 'Product Model A in violet',
		title: 'Model A — Violet Edition',
		text: 'A bold choice for those who prefer striking depth. Hand-finished with a matte violet coat.',
	},
	{
		src: slide('Model B', '#be185d'),
		alt: 'Product Model B in rose',
		title: 'Model B — Rose Edition',
		text: 'Warm rose tones with a satin finish. Pairs beautifully with neutral accessories.',
	},
	{
		src: slide('Model C', '#065f46'),
		alt: 'Product Model C in emerald',
		title: 'Model C — Emerald Edition',
		text: 'Cool emerald, inspired by alpine lakes. Scratch-resistant anodised aluminium.',
	},
];

// ── Demo C: autoplay + animated, 3 items ─────────────────────────────────
const itemsAutoplay: GalleryCardItem[] = [
	{ src: animated, alt: 'Animated yellow circle bouncing across a dark-blue background' },
	{ src: slide('Slide 2', '#9333ea'), alt: 'Purple slide' },
	{ src: slide('Slide 3', '#0f766e'), alt: 'Teal slide' },
];
</script>

<section id="comp-gallery-card" class="section">
	<h2 class="section-title">Gallery Card</h2>
	<p class="section-description">
		An Amazon-style image-gallery card: a large main image with a clickable thumbnail strip,
		paired with a title, copy, and optional CTA. Supports autoplay, reduced-motion awareness,
		synced per-item copy, and animated media (GIF / animated SVG / animated WebP) via a real
		<code>&lt;img&gt;</code> element. Reflows to a two-column layout on wider viewports.
	</p>

	<div class="demos">
		<!-- Demo A: fixed copy -->
		<DemoCard
			title="Default — fixed copy"
			description="Selecting thumbnails swaps only the image. Title and body text stay fixed."
		>
			<div class="demo-wrapper">
				<GalleryCard
					items={itemsFixed}
					title="Landscape Collection"
					text="Four iconic landscapes captured at golden hour. Click a thumbnail to explore each scene up close."
					cta={{ label: 'View full gallery', href: '/showcases/ui/components/composites' }}
				/>
			</div>
		</DemoCard>

		<!-- Demo B: synced copy -->
		<DemoCard
			title="Synced copy (text follows thumbnail)"
			description="Each item carries its own title and body text that replace the base copy when selected."
		>
			<div class="demo-wrapper">
				<GalleryCard
					items={itemsSynced}
					title="Product Series"
					text="Choose a colour to learn more."
					syncText
					cta={{ label: 'Add to cart', href: '/showcases/ui/components/composites' }}
				/>
			</div>
		</DemoCard>

		<!-- Demo C: autoplay + animated media -->
		<DemoCard
			title="Autoplay + animated media"
			description="Cycles every 3 s. Pauses on hover, focus, or the pause button. The first slide is an animated SVG (SMIL), proving animated-media support via <img>."
		>
			<div class="demo-wrapper">
				<GalleryCard
					items={itemsAutoplay}
					title="Autoplay Demo"
					text="The bouncing circle is a live SMIL animation rendered by the browser's image decoder — no canvas, no JS animation loop."
					autoplay
					autoplayInterval={3000}
					cta={{ label: 'Learn more', href: '/showcases/ui/components/composites' }}
				/>
			</div>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.demo-wrapper {
		width: 100%;
	}
</style>
