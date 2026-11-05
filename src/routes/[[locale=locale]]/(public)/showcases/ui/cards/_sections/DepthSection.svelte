<script lang="ts">
import { LatentCard, type LatentCardAction } from '#lib/components/composites/index.ts';
import { Accordion, Carousel, CarouselItem, ScrollArea } from '#lib/components/primitives/index.ts';
import { DemoCard } from '../../components/_components';

const actions: LatentCardAction[] = [
	{ id: 'open', label: 'Open', icon: 'i-lucide-arrow-up-right', tone: 'primary' },
	{ id: 'pin', label: 'Pin', icon: 'i-lucide-pin' },
	{ id: 'more', label: 'More', icon: 'i-lucide-ellipsis' },
];

const changelog = [
	{ version: '2.4.0', note: 'Offline drafts survive a sign-out.' },
	{ version: '2.3.2', note: 'Faster cold start on the desk.' },
	{ version: '2.3.1', note: 'Fixed the export button on Safari.' },
	{ version: '2.3.0', note: 'Record files on the desk.' },
	{ version: '2.2.0', note: 'Spreadsheet autosave with conflict rebase.' },
	{ version: '2.1.0', note: 'Command palette learns recent actions.' },
	{ version: '2.0.0', note: 'New design tokens and tonal elevation.' },
];

let openSpec = $state('');
const specs = [
	{ value: 'size', title: 'Size and weight', content: '42 × 28 × 9 cm, 1.4 kg. Fits a standard overhead bin.' },
	{
		value: 'material',
		title: 'Material',
		content: 'Recycled ripstop shell, water-repellent zips, padded laptop sleeve.',
	},
	{ value: 'warranty', title: 'Warranty', content: 'Five years on seams and zips; repairs before replacement.' },
];

const slides = [
	{ label: 'Front', tone: 'slide-primary' },
	{ label: 'Side', tone: 'slide-info' },
	{ label: 'Inside', tone: 'slide-success' },
];
</script>

<section id="cards-depth" class="section">
	<h2 class="section-title">Depth</h2>
	<p class="section-description">
		Level 2 holds what only some users want: a long list, a set of specifications, a gallery.
		Engaging the card tints its depth divider as a hint, but the depth itself opens only when the
		user scrolls, opens a fold or moves a slide. Hover reveals affordances; it never commits.
	</p>

	<div class="demos">
		<DemoCard
			title="Scroll area, accordion, carousel"
			description="The same card shell with three kinds of depth. Each depth keeps a fixed footprint, so a grid of cards never reflows when one is engaged."
		>
			<div class="card-grid">
				<LatentCard title="Release notes" eyebrow="Scroll area" {actions}>
					Seven releases this quarter.
					{#snippet depth()}
						<ScrollArea class="depth-scroll" type="auto">
							<ul class="changelog">
								{#each changelog as entry (entry.version)}
									<li><span class="version">{entry.version}</span> {entry.note}</li>
								{/each}
							</ul>
						</ScrollArea>
					{/snippet}
				</LatentCard>

				<LatentCard title="Travel pack 28" eyebrow="Accordion" {actions}>
					Carry-on backpack for short trips.
					{#snippet depth()}
						<Accordion items={specs} bind:value={openSpec} size="sm" />
					{/snippet}
				</LatentCard>

				<LatentCard title="Travel pack 28" eyebrow="Carousel" {actions}>
					Three views of the same pack.
					{#snippet depth()}
						<Carousel showDots showArrows>
							{#each slides as slide (slide.label)}
								<CarouselItem>
									<div class="slide {slide.tone}">{slide.label}</div>
								</CarouselItem>
							{/each}
						</Carousel>
					{/snippet}
				</LatentCard>
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

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		align-items: start;
		gap: var(--spacing-4);
		width: 100%;
	}

	.card-grid :global(.depth-scroll) {
		height: 8rem;
	}

	.changelog {
		margin: 0;
		padding: 0 var(--spacing-2) 0 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.version {
		font-family: var(--font-mono);
		color: var(--color-muted);
	}

	.slide {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 7rem;
		border-radius: var(--radius-md);
		font-weight: 600;
		color: var(--color-on-primary);
	}

	.slide-primary { background: var(--color-primary); }
	.slide-info { background: var(--color-info); }
	.slide-success { background: var(--color-success); }
</style>
