<script lang="ts">
	import { SectionNav } from '$lib/components/composites';
	import { DemoCard } from '../../components/_components';
	import {
		DotPattern,
		GridPattern,
		RetroGrid,
		GradientBlob
	} from '$lib/components';

	const sections = [
		{ id: 'bg-dot-pattern', label: 'DotPattern' },
		{ id: 'bg-grid-pattern', label: 'GridPattern' },
		{ id: 'bg-retro-grid', label: 'RetroGrid' },
		{ id: 'bg-gradient-blob', label: 'GradientBlob' },
		{ id: 'bg-utilities', label: 'Utilities' },
		{ id: 'bg-composition', label: 'Composition' },
	];
</script>

<svelte:head>
	<title>Backgrounds - Decorative - UI Showcase - Velociraptor</title>
</svelte:head>

<SectionNav {sections} />

<main class="content">
	<!-- DotPattern -->
	<section id="bg-dot-pattern" class="section">
		<h2 class="section-title">DotPattern</h2>
		<p class="section-description">Repeating dots via SVG pattern. Subtle texture for hero sections, cards, and empty states.</p>

		<div class="demos">
			<DemoCard title="Default" description="20px spacing, 1px radius, 15% opacity">
				<DotPattern class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="Custom Spacing" description="Tighter (12px) and wider (32px) dot grids">
				<div class="bg-row">
					<DotPattern spacing={12} class="rounded-lg min-h-[200px] flex-1" />
					<DotPattern spacing={32} radius={1.5} class="rounded-lg min-h-[200px] flex-1" />
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Content overlaid on dot pattern">
				<DotPattern spacing={16} opacity={0.2} class="rounded-lg min-h-[200px] w-full">
					<div class="overlay-content">
						<h3 class="overlay-title">Dot Pattern Background</h3>
						<p class="overlay-text">Content renders above the pattern layer.</p>
					</div>
				</DotPattern>
			</DemoCard>

			<DemoCard title="Colored Dots" description="Using theme colors">
				<div class="bg-row">
					<DotPattern color="var(--color-primary)" opacity={0.25} class="rounded-lg min-h-[160px] flex-1" />
					<DotPattern color="var(--color-success)" opacity={0.25} class="rounded-lg min-h-[160px] flex-1" />
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- GridPattern -->
	<section id="bg-grid-pattern" class="section">
		<h2 class="section-title">GridPattern</h2>
		<p class="section-description">Grid lines via SVG pattern with optional highlighted cells. Technical and engineering aesthetics.</p>

		<div class="demos">
			<DemoCard title="Default" description="30px cells, 1px stroke, 10% opacity">
				<GridPattern class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="With Highlights" description="Selected cells get a subtle fill">
				<GridPattern
					highlights={[[1, 1], [2, 2], [3, 1], [4, 3], [5, 2]]}
					class="rounded-lg min-h-[200px] w-full"
				/>
			</DemoCard>

			<DemoCard title="Fine Grid" description="Smaller cells for dense patterns">
				<GridPattern cellSize={16} strokeWidth={0.5} opacity={0.15} class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="With Content" description="Content overlaid on grid">
				<GridPattern cellSize={24} opacity={0.12} class="rounded-lg min-h-[200px] w-full">
					<div class="overlay-content">
						<h3 class="overlay-title">Grid Pattern Background</h3>
						<p class="overlay-text">Grid creates a technical, engineering feel.</p>
					</div>
				</GridPattern>
			</DemoCard>
		</div>
	</section>

	<!-- RetroGrid -->
	<section id="bg-retro-grid" class="section">
		<h2 class="section-title">RetroGrid</h2>
		<p class="section-description">Perspective grid with vanishing point effect. Pure CSS gradients and transforms. Retro-futuristic aesthetic.</p>

		<div class="demos">
			<DemoCard title="Default" description="300px perspective, 60deg tilt">
				<RetroGrid class="rounded-lg min-h-[300px] w-full" />
			</DemoCard>

			<DemoCard title="Animated" description="Scrolling grid animation">
				<RetroGrid animated class="rounded-lg min-h-[300px] w-full" />
			</DemoCard>

			<DemoCard title="Perspective Variants" description="Shallow (600px) vs deep (150px)">
				<div class="bg-row">
					<RetroGrid perspective={600} class="rounded-lg min-h-[250px] flex-1" />
					<RetroGrid perspective={150} class="rounded-lg min-h-[250px] flex-1" />
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Hero section with retro grid">
				<RetroGrid animated opacity={0.12} class="rounded-lg min-h-[300px] w-full">
					<div class="overlay-content overlay-centered">
						<h3 class="overlay-hero">RETRO GRID</h3>
						<p class="overlay-text">A vanishing-point perspective grid for hero sections.</p>
					</div>
				</RetroGrid>
			</DemoCard>
		</div>
	</section>

	<!-- GradientBlob -->
	<section id="bg-gradient-blob" class="section">
		<h2 class="section-title">GradientBlob</h2>
		<p class="section-description">Radial gradient blobs with blur and optional animation. Organic, ambient atmosphere.</p>

		<div class="demos">
			<DemoCard title="Default" description="Primary, success, warning blobs at 15% opacity">
				<GradientBlob class="rounded-lg min-h-[250px] w-full" />
			</DemoCard>

			<DemoCard title="Animated" description="Floating blob animation">
				<GradientBlob animated class="rounded-lg min-h-[250px] w-full" />
			</DemoCard>

			<DemoCard title="Custom Colors" description="Single-tone and dual-tone">
				<div class="bg-row">
					<GradientBlob
						colors={['var(--color-primary)', 'var(--color-info)']}
						opacity={0.2}
						class="rounded-lg min-h-[200px] flex-1"
					/>
					<GradientBlob
						colors={['var(--color-error)', 'var(--color-warning)', 'var(--color-primary)']}
						opacity={0.2}
						class="rounded-lg min-h-[200px] flex-1"
					/>
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Content over animated blobs">
				<GradientBlob animated opacity={0.12} class="rounded-lg min-h-[250px] w-full">
					<div class="overlay-content overlay-centered">
						<h3 class="overlay-hero">GRADIENT BLOBS</h3>
						<p class="overlay-text">Organic, ambient atmosphere for hero sections and landing pages.</p>
					</div>
				</GradientBlob>
			</DemoCard>
		</div>
	</section>

	<!-- CSS Utilities -->
	<section id="bg-utilities" class="section">
		<h2 class="section-title">CSS Utilities</h2>
		<p class="section-description">Lightweight UnoCSS shortcuts for simple dot and grid patterns. No component wrapper needed.</p>

		<div class="demos">
			<DemoCard title="bg-dots" description="radial-gradient dot pattern via UnoCSS shortcut">
				<div class="bg-dots rounded-lg min-h-[160px] w-full utility-demo"></div>
			</DemoCard>

			<DemoCard title="bg-grid" description="linear-gradient grid pattern via UnoCSS shortcut">
				<div class="bg-grid rounded-lg min-h-[160px] w-full utility-demo"></div>
			</DemoCard>
		</div>
	</section>

	<!-- Composition -->
	<section id="bg-composition" class="section">
		<h2 class="section-title">Composition</h2>
		<p class="section-description">Combining backgrounds with content for real-world layouts.</p>

		<div class="demos">
			<DemoCard title="Card with Dot Pattern" description="A card component using DotPattern as background">
				<DotPattern spacing={16} opacity={0.12} class="composition-card">
					<div class="card-content">
						<span class="card-badge">New</span>
						<h3 class="card-title">Feature Card</h3>
						<p class="card-text">Background patterns add visual depth to card components without overwhelming the content.</p>
					</div>
				</DotPattern>
			</DemoCard>

			<DemoCard title="Hero with Blobs + Grid" description="Layered backgrounds for rich atmosphere">
				<div class="hero-composition">
					<GradientBlob animated opacity={0.1} class="hero-layer">
						<GridPattern cellSize={40} opacity={0.06} class="hero-layer">
							<div class="overlay-content overlay-centered">
								<h3 class="overlay-hero">LAYERED BACKGROUNDS</h3>
								<p class="overlay-text">Combine multiple background components for rich, layered atmospheric effects.</p>
							</div>
						</GridPattern>
					</GradientBlob>
				</div>
			</DemoCard>
		</div>
	</section>
</main>

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

	.bg-row {
		display: flex;
		gap: var(--spacing-4);
		width: 100%;
	}

	@media (max-width: 640px) {
		.bg-row {
			flex-direction: column;
		}
	}

	.overlay-content {
		padding: var(--spacing-7);
	}

	.overlay-centered {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: inherit;
	}

	.overlay-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2) 0;
	}

	.overlay-hero {
		font-size: var(--text-fluid-3xl);
		font-weight: 800;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-3) 0;
		letter-spacing: 0.05em;
	}

	.overlay-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
		max-width: 36ch;
	}

	.utility-demo {
		opacity: 0.15;
	}

	:global(.composition-card) {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		width: 100%;
		max-width: 360px;
	}

	.card-content {
		padding: var(--spacing-6);
	}

	.card-badge {
		display: inline-block;
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		padding: 2px 8px;
		border-radius: var(--radius-full);
		margin-bottom: var(--spacing-3);
	}

	.card-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2) 0;
	}

	.card-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
		line-height: 1.6;
	}

	.hero-composition {
		width: 100%;
		min-height: 300px;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.hero-composition :global(.hero-layer) {
		min-height: 300px;
		width: 100%;
	}
</style>
