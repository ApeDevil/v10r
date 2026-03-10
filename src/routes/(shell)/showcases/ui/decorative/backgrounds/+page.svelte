<script lang="ts">
import {
	DotPattern,
	FadeMask,
	GradientBlob,
	GridPattern,
	LineFill,
	NoiseTexture,
	RadialGlow,
	RetroGrid,
} from '$lib/components';
import { NavSection } from '$lib/components/composites';
import { DemoCard } from '../../components/_components';

const sections = [
	{ id: 'bg-dot-pattern', label: 'DotPattern' },
	{ id: 'bg-grid-pattern', label: 'GridPattern' },
	{ id: 'bg-retro-grid', label: 'RetroGrid' },
	{ id: 'bg-gradient-blob', label: 'GradientBlob' },
	{ id: 'bg-noise-texture', label: 'NoiseTexture' },
	{ id: 'bg-radial-glow', label: 'RadialGlow' },
	{ id: 'bg-fade-mask', label: 'FadeMask' },
	{ id: 'bg-line-fill', label: 'LineFill' },
	{ id: 'bg-utilities', label: 'Utilities' },
	{ id: 'bg-composition', label: 'Composition' },
];

const blendModes = ['overlay', 'soft-light', 'multiply', 'screen'] as const;
const glowPositions = ['center', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const glowSizes = ['sm', 'md', 'lg', 'full'] as const;
const lineVariants = ['scanline', 'hatch', 'crosshatch'] as const;
</script>

<svelte:head>
	<title>Backgrounds - Decorative - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<!-- DotPattern -->
	<section id="bg-dot-pattern" class="section">
		<h2 class="section-title">DotPattern</h2>
		<p class="section-description">Repeating dots via SVG pattern. Subtle texture for hero sections, cards, and empty states.</p>

		<div class="demos">
			<DemoCard title="Default" description="20px spacing, 1.5px radius, 40% opacity">
				<DotPattern radius={1.5} opacity={0.4} class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="Custom Spacing" description="Tighter (12px) and wider (32px) dot grids">
				<div class="bg-row">
					<DotPattern spacing={12} radius={1.5} opacity={0.35} class="rounded-lg min-h-[200px] flex-1" />
					<DotPattern spacing={32} radius={2} opacity={0.35} class="rounded-lg min-h-[200px] flex-1" />
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Content overlaid on dot pattern">
				<DotPattern spacing={16} radius={1.5} opacity={0.3} class="rounded-lg min-h-[200px] w-full">
					<div class="overlay-content">
						<h3 class="overlay-title">Dot Pattern Background</h3>
						<p class="overlay-text">Content renders above the pattern layer.</p>
					</div>
				</DotPattern>
			</DemoCard>

			<DemoCard title="Colored Dots" description="Using theme colors">
				<div class="bg-row">
					<DotPattern color="var(--color-primary)" radius={1.5} opacity={0.5} class="rounded-lg min-h-[160px] flex-1" />
					<DotPattern color="var(--color-success)" radius={1.5} opacity={0.5} class="rounded-lg min-h-[160px] flex-1" />
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- GridPattern -->
	<section id="bg-grid-pattern" class="section">
		<h2 class="section-title">GridPattern</h2>
		<p class="section-description">Grid lines via SVG pattern with optional highlighted cells. Technical and engineering aesthetics.</p>

		<div class="demos">
			<DemoCard title="Default" description="30px cells, 1px stroke, 30% opacity">
				<GridPattern opacity={0.3} class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="With Highlights" description="Selected cells get a subtle fill">
				<GridPattern
					opacity={0.25}
					highlights={[[1, 1], [2, 2], [3, 1], [4, 3], [5, 2]]}
					class="rounded-lg min-h-[200px] w-full"
				/>
			</DemoCard>

			<DemoCard title="Fine Grid" description="Smaller cells for dense patterns">
				<GridPattern cellSize={16} strokeWidth={0.5} opacity={0.25} class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="With Content" description="Content overlaid on grid">
				<GridPattern cellSize={24} opacity={0.2} class="rounded-lg min-h-[200px] w-full">
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
			<DemoCard title="Default" description="Primary, success, warning blobs at 25% opacity">
				<GradientBlob opacity={0.25} class="rounded-lg min-h-[250px] w-full" />
			</DemoCard>

			<DemoCard title="Animated" description="Floating blob animation">
				<GradientBlob animated opacity={0.25} class="rounded-lg min-h-[250px] w-full" />
			</DemoCard>

			<DemoCard title="Custom Colors" description="Single-tone and dual-tone">
				<div class="bg-row">
					<GradientBlob
						colors={['var(--color-primary)', 'var(--color-info)']}
						opacity={0.3}
						class="rounded-lg min-h-[200px] flex-1"
					/>
					<GradientBlob
						colors={['var(--color-error)', 'var(--color-warning)', 'var(--color-primary)']}
						opacity={0.3}
						class="rounded-lg min-h-[200px] flex-1"
					/>
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Content over animated blobs">
				<GradientBlob animated opacity={0.15} class="rounded-lg min-h-[250px] w-full">
					<div class="overlay-content overlay-centered">
						<h3 class="overlay-hero">GRADIENT BLOBS</h3>
						<p class="overlay-text">Organic, ambient atmosphere for hero sections and landing pages.</p>
					</div>
				</GradientBlob>
			</DemoCard>
		</div>
	</section>

	<!-- NoiseTexture -->
	<section id="bg-noise-texture" class="section">
		<h2 class="section-title">NoiseTexture</h2>
		<p class="section-description">SVG feTurbulence film grain. Desaturated noise blended over content for tactile, analog texture.</p>

		<div class="demos">
			<DemoCard title="Default" description="0.65 frequency, 4 octaves, overlay blend at 15%">
				<NoiseTexture opacity={0.15} class="rounded-lg min-h-[200px] w-full bg-surface-1" />
			</DemoCard>

			<DemoCard title="Blend Modes" description="overlay, soft-light, multiply, screen">
				<div class="bg-row bg-row-wrap">
					{#each blendModes as mode}
						<div class="blend-item">
							<NoiseTexture blend={mode} opacity={0.2} class="rounded-lg min-h-[120px] w-full bg-surface-1" />
							<span class="blend-label">{mode}</span>
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Grain Density" description="Low (0.3) vs high (1.2) frequency">
				<div class="bg-row">
					<div class="blend-item flex-1">
						<NoiseTexture frequency={0.3} opacity={0.2} class="rounded-lg min-h-[160px] w-full bg-surface-1" />
						<span class="blend-label">coarse (0.3)</span>
					</div>
					<div class="blend-item flex-1">
						<NoiseTexture frequency={1.2} opacity={0.2} class="rounded-lg min-h-[160px] w-full bg-surface-1" />
						<span class="blend-label">fine (1.2)</span>
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Composited with GradientBlob" description="Noise texture over animated blobs">
				<GradientBlob animated opacity={0.15} class="rounded-lg min-h-[250px] w-full">
					<NoiseTexture opacity={0.12} class="noise-overlay">
						<div class="overlay-content overlay-centered">
							<h3 class="overlay-hero">GRAIN + BLOBS</h3>
							<p class="overlay-text">Film grain adds tactile quality over smooth gradients.</p>
						</div>
					</NoiseTexture>
				</GradientBlob>
			</DemoCard>
		</div>
	</section>

	<!-- RadialGlow -->
	<section id="bg-radial-glow" class="section">
		<h2 class="section-title">RadialGlow</h2>
		<p class="section-description">Pure CSS radial-gradient spotlight. Focal-point backgrounds for hero sections and cards.</p>

		<div class="demos">
			<DemoCard title="Default" description="Primary color, center position, medium size at 25%">
				<RadialGlow opacity={0.25} class="rounded-lg min-h-[200px] w-full" />
			</DemoCard>

			<DemoCard title="Positions" description="Seven anchor points for the gradient">
				<div class="bg-row bg-row-wrap">
					{#each glowPositions as pos}
						<div class="glow-item">
							<RadialGlow position={pos} opacity={0.3} class="rounded-lg min-h-[100px] w-full" />
							<span class="blend-label">{pos}</span>
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Sizes" description="sm (closest-side), md (farthest-corner), lg (farthest-side), full">
				<div class="bg-row bg-row-wrap">
					{#each glowSizes as s}
						<div class="glow-item">
							<RadialGlow size={s} opacity={0.3} class="rounded-lg min-h-[100px] w-full" />
							<span class="blend-label">{s}</span>
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Primary, success, warning glows">
				<div class="bg-row">
					<RadialGlow color="var(--color-primary)" opacity={0.3} class="rounded-lg min-h-[160px] flex-1" />
					<RadialGlow color="var(--color-success)" opacity={0.3} class="rounded-lg min-h-[160px] flex-1" />
					<RadialGlow color="var(--color-warning)" opacity={0.3} class="rounded-lg min-h-[160px] flex-1" />
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Hero section with radial glow spotlight">
				<RadialGlow color="var(--color-primary)" position="top" size="lg" opacity={0.25} class="rounded-lg min-h-[250px] w-full">
					<div class="overlay-content overlay-centered">
						<h3 class="overlay-hero">SPOTLIGHT</h3>
						<p class="overlay-text">Radial glow creates a focal point that draws the eye.</p>
					</div>
				</RadialGlow>
			</DemoCard>
		</div>
	</section>

	<!-- FadeMask -->
	<section id="bg-fade-mask" class="section">
		<h2 class="section-title">FadeMask</h2>
		<p class="section-description">CSS mask-image gradients that fade content edges. Pure CSS, no JS animation.</p>

		<div class="demos">
			<DemoCard title="Single Edge (bottom)" description="Default: bottom edge fades to transparent">
				<FadeMask class="rounded-lg w-full">
					<div class="fade-demo-content">
						<p class="fade-text">This content fades at the bottom edge. Useful for long lists, scrollable areas, or decorative cutoffs that suggest more content below.</p>
						<p class="fade-text">Second paragraph provides enough height to see the fade effect clearly.</p>
						<p class="fade-text">Third paragraph is almost invisible, masked by the gradient.</p>
					</div>
				</FadeMask>
			</DemoCard>

			<DemoCard title="Multiple Edges (top + bottom)" description="Vertical fade on both ends">
				<FadeMask edges={['top', 'bottom']} class="rounded-lg w-full">
					<div class="fade-demo-content">
						<p class="fade-text">Top edge fades in.</p>
						<p class="fade-text">Middle content remains fully visible.</p>
						<p class="fade-text">Bottom edge fades out.</p>
					</div>
				</FadeMask>
			</DemoCard>

			<DemoCard title="Vignette (all edges)" description="All four edges fade over a GridPattern">
				<FadeMask edges={['top', 'bottom', 'left', 'right']} size={64} class="rounded-lg w-full">
					<GridPattern cellSize={24} opacity={0.3} class="rounded-lg min-h-[200px] w-full" />
				</FadeMask>
			</DemoCard>

			<DemoCard title="Custom Sizes" description="16px tight vs 96px wide fade">
				<div class="bg-row">
					<FadeMask edges={['bottom']} size={16} class="rounded-lg flex-1">
						<div class="fade-demo-content fade-demo-sm">
							<p class="fade-text">16px fade — tight cutoff.</p>
							<p class="fade-text">Content disappears quickly.</p>
						</div>
					</FadeMask>
					<FadeMask edges={['bottom']} size={96} class="rounded-lg flex-1">
						<div class="fade-demo-content fade-demo-sm">
							<p class="fade-text">96px fade — gradual falloff.</p>
							<p class="fade-text">Content disappears slowly.</p>
						</div>
					</FadeMask>
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- LineFill -->
	<section id="bg-line-fill" class="section">
		<h2 class="section-title">LineFill</h2>
		<p class="section-description">Repeating line patterns via SVG. Scanlines, hatching, and crosshatching for editorial and technical textures.</p>

		<div class="demos">
			<DemoCard title="All Variants" description="scanline, hatch, crosshatch">
				<div class="bg-row bg-row-wrap">
					{#each lineVariants as variant}
						<div class="blend-item flex-1">
							<LineFill {variant} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[160px] w-full" />
							<span class="blend-label">{variant}</span>
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Spacing" description="Tight (12px) vs wide (24px) scanlines">
				<div class="bg-row">
					<div class="blend-item flex-1">
						<LineFill spacing={12} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[160px] w-full" />
						<span class="blend-label">12px</span>
					</div>
					<div class="blend-item flex-1">
						<LineFill spacing={24} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[160px] w-full" />
						<span class="blend-label">24px</span>
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Stroke Width" description="Hairline (0.5px) vs thick (2px)">
				<div class="bg-row">
					<div class="blend-item flex-1">
						<LineFill strokeWidth={0.5} spacing={16} opacity={0.35} class="rounded-lg min-h-[160px] w-full" />
						<span class="blend-label">0.5px</span>
					</div>
					<div class="blend-item flex-1">
						<LineFill strokeWidth={2} spacing={16} opacity={0.35} class="rounded-lg min-h-[160px] w-full" />
						<span class="blend-label">2px</span>
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Custom Angles" description="Diagonal hatching at different angles">
				<div class="bg-row bg-row-wrap">
					<div class="blend-item flex-1">
						<LineFill variant="hatch" angle={30} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[140px] w-full" />
						<span class="blend-label">30deg</span>
					</div>
					<div class="blend-item flex-1">
						<LineFill variant="hatch" angle={45} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[140px] w-full" />
						<span class="blend-label">45deg</span>
					</div>
					<div class="blend-item flex-1">
						<LineFill variant="hatch" angle={60} opacity={0.3} strokeWidth={1.5} class="rounded-lg min-h-[140px] w-full" />
						<span class="blend-label">60deg</span>
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Colored line fills">
				<div class="bg-row">
					<LineFill variant="hatch" color="var(--color-primary)" opacity={0.5} strokeWidth={1.5} class="rounded-lg min-h-[140px] flex-1" />
					<LineFill variant="crosshatch" color="var(--color-success)" opacity={0.5} strokeWidth={1.5} class="rounded-lg min-h-[140px] flex-1" />
					<LineFill color="var(--color-warning)" opacity={0.5} strokeWidth={1.5} class="rounded-lg min-h-[140px] flex-1" />
				</div>
			</DemoCard>

			<DemoCard title="With Content" description="Content overlaid on hatch pattern">
				<LineFill variant="hatch" opacity={0.15} strokeWidth={1.5} class="rounded-lg min-h-[200px] w-full">
					<div class="overlay-content overlay-centered">
						<h3 class="overlay-hero">HATCHED</h3>
						<p class="overlay-text">Line fills add draftsmanship texture behind content.</p>
					</div>
				</LineFill>
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
				<DotPattern spacing={16} radius={1.5} opacity={0.25} class="composition-card">
					<div class="card-content">
						<span class="card-badge">New</span>
						<h3 class="card-title">Feature Card</h3>
						<p class="card-text">Background patterns add visual depth to card components without overwhelming the content.</p>
					</div>
				</DotPattern>
			</DemoCard>

			<DemoCard title="Hero with Blobs + Grid" description="Layered backgrounds for rich atmosphere">
				<div class="hero-composition">
					<GradientBlob animated opacity={0.15} class="hero-layer">
						<GridPattern cellSize={40} opacity={0.15} class="hero-layer">
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

	.bg-row-wrap {
		flex-wrap: wrap;
	}

	.blend-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 140px;
	}

	.blend-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: monospace;
	}

	.glow-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 120px;
		flex: 1;
	}

	:global(.noise-overlay) {
		min-height: 250px;
		width: 100%;
	}

	.fade-demo-content {
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.fade-demo-sm {
		min-height: 120px;
	}

	.fade-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.6;
	}

	.utility-demo {
		opacity: 0.35;
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
