<script lang="ts">
import {
	Asterism,
	ConcentricRings,
	CornerFrame,
	Divider,
	Flourish,
	GeometricMark,
	Kamon,
	Marquee,
	TickMarks,
	WaveDivider,
} from '$lib/components';
import { NavSection } from '$lib/components/composites';
import { DemoCard, VariantGrid } from '../../components/_components';

const sections = [
	{ id: 'dec-geometric-mark', label: 'GeometricMark' },
	{ id: 'dec-divider', label: 'Divider' },
	{ id: 'dec-asterism', label: 'Asterism' },
	{ id: 'dec-kamon', label: 'Kamon' },
	{ id: 'dec-flourish', label: 'Flourish' },
	{ id: 'dec-wave-divider', label: 'WaveDivider' },
	{ id: 'dec-corner-frame', label: 'CornerFrame' },
	{ id: 'dec-concentric-rings', label: 'ConcentricRings' },
	{ id: 'dec-tick-marks', label: 'TickMarks' },
	{ id: 'dec-marquee', label: 'Marquee' },
];

const waveShapes = ['wave', 'curve', 'zigzag', 'slant'] as const;

const shapes = ['circle', 'hexagon', 'triangle', 'square', 'cross', 'diamond'] as const;
const motifs = ['none', 'dot', 'diamond', 'crosshair', 'flourish'] as const;
const patterns = ['three-dots', 'fleuron', 'dinkus', 'star'] as const;
const foldCounts = [3, 4, 5, 6, 7, 8] as const;
const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const frameVariants = ['bracket', 'double', 'inset', 'cross'] as const;
const ringShapes = ['circle', 'square', 'hexagon'] as const;
const ringCounts = [2, 3, 4, 5, 6, 7, 8] as const;
</script>

<svelte:head>
	<title>Ornaments - Decorative - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<!-- GeometricMark -->
	<section id="dec-geometric-mark" class="section">
		<h2 class="section-title">GeometricMark</h2>
		<p class="section-description">Simple geometric shapes as small accents. Bullet replacements, list markers, card accents.</p>

		<div class="demos">
			<DemoCard title="All Shapes" description="Six geometric primitives at 24px">
				<VariantGrid layout="row">
					{#each shapes as shape}
						<div class="shape-item">
							<GeometricMark {shape} />
							<span class="shape-label">{shape}</span>
						</div>
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Filled Variants" description="Solid fill instead of stroke">
				<VariantGrid layout="row">
					{#each shapes as shape}
						<GeometricMark {shape} filled />
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Sizes" description="16px, 24px, 32px, 48px">
				<VariantGrid layout="row">
					<GeometricMark shape="hexagon" size={16} />
					<GeometricMark shape="hexagon" size={24} />
					<GeometricMark shape="hexagon" size={32} />
					<GeometricMark shape="hexagon" size={48} />
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Using CSS variable colors">
				<VariantGrid layout="row">
					<GeometricMark shape="diamond" filled color="var(--color-primary)" />
					<GeometricMark shape="diamond" filled color="var(--color-success)" />
					<GeometricMark shape="diamond" filled color="var(--color-warning)" />
					<GeometricMark shape="diamond" filled color="var(--color-error)" />
				</VariantGrid>
			</DemoCard>
		</div>
	</section>

	<!-- Divider -->
	<section id="dec-divider" class="section">
		<h2 class="section-title">Divider</h2>
		<p class="section-description">Decorative horizontal rule replacement with optional center motif.</p>

		<div class="demos">
			<DemoCard title="Motif Variants" description="Different center decorations">
				<div class="divider-stack">
					{#each motifs as motif}
						<div class="divider-row">
							<span class="motif-label">{motif}</span>
							<Divider {motif} />
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Width Variants" description="Full, content (75%), narrow (50%)">
				<div class="divider-stack">
					<Divider motif="diamond" width="full" />
					<Divider motif="diamond" width="content" />
					<Divider motif="diamond" width="narrow" />
				</div>
			</DemoCard>

			<DemoCard title="Custom Opacity" description="Higher opacity for stronger presence">
				<div class="divider-stack">
					<Divider motif="dot" opacity={0.1} />
					<Divider motif="dot" opacity={0.3} />
					<Divider motif="dot" opacity={0.6} />
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- Asterism -->
	<section id="dec-asterism" class="section">
		<h2 class="section-title">Asterism</h2>
		<p class="section-description">Typographic section break. Classic article and book section separators.</p>

		<div class="demos">
			<DemoCard title="All Patterns" description="Four typographic separator styles">
				<div class="asterism-stack">
					{#each patterns as pattern}
						<div class="asterism-row">
							<span class="motif-label">{pattern}</span>
							<Asterism {pattern} />
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Sizes" description="12px, 16px, 24px">
				<div class="asterism-stack">
					<Asterism pattern="star" size={12} />
					<Asterism pattern="star" size={16} />
					<Asterism pattern="star" size={24} />
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- Kamon -->
	<section id="dec-kamon" class="section">
		<h2 class="section-title">Kamon</h2>
		<p class="section-description">Japanese kamon-inspired geometric marks with rotational symmetry. Hero accents, empty states, auth pages.</p>

		<div class="demos">
			<DemoCard title="Fold Counts" description="3 to 8 rotational folds">
				<VariantGrid layout="row">
					{#each foldCounts as folds}
						<div class="shape-item">
							<Kamon {folds} />
							<span class="shape-label">{folds}-fold</span>
						</div>
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Filled Variants" description="Solid fill creates rosette patterns">
				<VariantGrid layout="row">
					{#each foldCounts as folds}
						<Kamon {folds} filled />
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Sizes" description="32px, 64px, 96px, 128px">
				<VariantGrid layout="row">
					<Kamon size={32} />
					<Kamon size={64} />
					<Kamon size={96} />
					<Kamon size={128} />
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Using CSS variable colors">
				<VariantGrid layout="row">
					<Kamon color="var(--color-primary)" filled />
					<Kamon color="var(--color-success)" folds={5} />
					<Kamon color="var(--color-warning)" folds={8} filled />
					<Kamon color="var(--color-error)" folds={3} />
				</VariantGrid>
			</DemoCard>
		</div>
	</section>

	<!-- Flourish -->
	<section id="dec-flourish" class="section">
		<h2 class="section-title">Flourish</h2>
		<p class="section-description">Corner bezier curves. Absolutely positioned within a relative parent.</p>

		<div class="demos">
			<DemoCard title="All Positions" description="Four corners of a container">
				<div class="flourish-container">
					{#each positions as position}
						<Flourish {position} />
					{/each}
					<span class="flourish-label">All four corners</span>
				</div>
			</DemoCard>

			<DemoCard title="Sizes" description="32px, 48px, 64px corner flourishes">
				<VariantGrid layout="row">
					<div class="flourish-container flourish-sm">
						<Flourish position="top-left" size={32} />
						<Flourish position="bottom-right" size={32} />
					</div>
					<div class="flourish-container">
						<Flourish position="top-left" size={48} />
						<Flourish position="bottom-right" size={48} />
					</div>
					<div class="flourish-container flourish-lg">
						<Flourish position="top-left" size={64} />
						<Flourish position="bottom-right" size={64} />
					</div>
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Flourishes in theme colors">
				<VariantGrid layout="row">
					<div class="flourish-container">
						<Flourish position="top-left" color="var(--color-primary)" />
						<Flourish position="bottom-right" color="var(--color-primary)" />
					</div>
					<div class="flourish-container">
						<Flourish position="top-right" color="var(--color-success)" />
						<Flourish position="bottom-left" color="var(--color-success)" />
					</div>
				</VariantGrid>
			</DemoCard>
		</div>
	</section>

	<!-- WaveDivider -->
	<section id="dec-wave-divider" class="section">
		<h2 class="section-title">WaveDivider</h2>
		<p class="section-description">Full-width SVG section separator. Stretches to fill container width with preserveAspectRatio="none".</p>

		<div class="demos">
			<DemoCard title="All Shapes" description="wave, curve, zigzag, slant">
				<div class="wave-stack">
					{#each waveShapes as shape}
						<div class="wave-item">
							<span class="motif-label">{shape}</span>
							<WaveDivider {shape} />
						</div>
					{/each}
				</div>
			</DemoCard>

			<DemoCard title="Flipped" description="Vertical mirror for top-of-section placement">
				<div class="wave-stack">
					<div class="wave-item">
						<span class="motif-label">normal</span>
						<WaveDivider shape="wave" />
					</div>
					<div class="wave-item">
						<span class="motif-label">flipped</span>
						<WaveDivider shape="wave" flip />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Heights" description="24px, 48px, 96px">
				<div class="wave-stack">
					<div class="wave-item">
						<span class="motif-label">24px</span>
						<WaveDivider shape="curve" height={24} />
					</div>
					<div class="wave-item">
						<span class="motif-label">48px</span>
						<WaveDivider shape="curve" height={48} />
					</div>
					<div class="wave-item">
						<span class="motif-label">96px</span>
						<WaveDivider shape="curve" height={96} />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Using CSS variable colors">
				<div class="wave-stack">
					<WaveDivider shape="wave" color="var(--color-primary)" />
					<WaveDivider shape="curve" color="var(--color-success)" />
					<WaveDivider shape="zigzag" color="var(--color-warning)" />
					<WaveDivider shape="slant" color="var(--color-error)" />
				</div>
			</DemoCard>

			<DemoCard title="Section Transition" description="Sandwiched between colored sections">
				<div class="wave-transition">
					<div class="wave-section-top">
						<p class="wave-section-text">Section above</p>
					</div>
					<WaveDivider shape="wave" color="var(--color-primary)" />
					<div class="wave-section-bottom">
						<p class="wave-section-text">Section below</p>
					</div>
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- CornerFrame -->
	<section id="dec-corner-frame" class="section">
		<h2 class="section-title">CornerFrame</h2>
		<p class="section-description">Decorative corner brackets. Absolutely positioned within a relative parent. Certificates, pull quotes, menus.</p>

		<div class="demos">
			<DemoCard title="All Variants" description="bracket, double, inset, cross">
				<VariantGrid layout="row">
					{#each frameVariants as variant}
						<div class="frame-demo-item">
							<div class="frame-container">
								<CornerFrame {variant} />
								<span class="flourish-label">{variant}</span>
							</div>
						</div>
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Selective Corners" description="Only top corners or diagonal pair">
				<VariantGrid layout="row">
					<div class="frame-container">
						<CornerFrame corners={['top-left', 'top-right']} />
						<span class="flourish-label">top pair</span>
					</div>
					<div class="frame-container">
						<CornerFrame corners={['top-left', 'bottom-right']} />
						<span class="flourish-label">diagonal</span>
					</div>
					<div class="frame-container">
						<CornerFrame corners={['bottom-left']} />
						<span class="flourish-label">single</span>
					</div>
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Sizes" description="16px, 24px, 32px, 48px corner marks">
				<VariantGrid layout="row">
					<div class="frame-container frame-sm">
						<CornerFrame size={16} />
					</div>
					<div class="frame-container">
						<CornerFrame size={24} />
					</div>
					<div class="frame-container frame-md">
						<CornerFrame size={32} />
					</div>
					<div class="frame-container frame-lg">
						<CornerFrame size={48} />
					</div>
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Colored corner frames">
				<VariantGrid layout="row">
					<div class="frame-container">
						<CornerFrame color="var(--color-primary)" />
						<span class="flourish-label">primary</span>
					</div>
					<div class="frame-container">
						<CornerFrame variant="double" color="var(--color-success)" />
						<span class="flourish-label">success</span>
					</div>
					<div class="frame-container">
						<CornerFrame variant="cross" color="var(--color-warning)" />
						<span class="flourish-label">warning</span>
					</div>
				</VariantGrid>
			</DemoCard>
		</div>
	</section>

	<!-- ConcentricRings -->
	<section id="dec-concentric-rings" class="section">
		<h2 class="section-title">ConcentricRings</h2>
		<p class="section-description">Expanding concentric shapes from center. Ripple, radar, and crystalline patterns for section headers and accents.</p>

		<div class="demos">
			<DemoCard title="Ring Counts" description="2 to 8 concentric circles">
				<VariantGrid layout="row">
					{#each ringCounts as rings}
						<div class="shape-item">
							<ConcentricRings {rings} size={80} />
							<span class="shape-label">{rings} rings</span>
						</div>
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Shapes" description="circle, square, hexagon">
				<VariantGrid layout="row">
					{#each ringShapes as shape}
						<div class="shape-item">
							<ConcentricRings {shape} rings={5} size={120} />
							<span class="shape-label">{shape}</span>
						</div>
					{/each}
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Sizes" description="60px, 120px, 200px">
				<VariantGrid layout="row">
					<ConcentricRings size={60} rings={3} spacing={8} />
					<ConcentricRings size={120} rings={5} />
					<ConcentricRings size={200} rings={6} spacing={16} />
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Spacing" description="Tight (8px) vs wide (20px)">
				<VariantGrid layout="row">
					<div class="shape-item">
						<ConcentricRings spacing={8} rings={5} size={100} />
						<span class="shape-label">8px</span>
					</div>
					<div class="shape-item">
						<ConcentricRings spacing={14} rings={5} size={160} />
						<span class="shape-label">14px</span>
					</div>
					<div class="shape-item">
						<ConcentricRings spacing={20} rings={5} size={220} />
						<span class="shape-label">20px</span>
					</div>
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Using CSS variable colors">
				<VariantGrid layout="row">
					<ConcentricRings color="var(--color-primary)" rings={4} size={100} opacity={0.3} />
					<ConcentricRings color="var(--color-success)" shape="hexagon" rings={5} size={100} opacity={0.3} />
					<ConcentricRings color="var(--color-warning)" shape="square" rings={3} size={100} opacity={0.3} />
					<ConcentricRings color="var(--color-error)" rings={6} size={100} opacity={0.3} />
				</VariantGrid>
			</DemoCard>
		</div>
	</section>

	<!-- TickMarks -->
	<section id="dec-tick-marks" class="section">
		<h2 class="section-title">TickMarks</h2>
		<p class="section-description">Ruled-edge measuring tape aesthetic. Decorative ticks for timelines, footers, and technical UI.</p>

		<div class="demos">
			<DemoCard title="Default (Horizontal)" description="21 ticks, major every 5, 10px gap">
				<TickMarks />
			</DemoCard>

			<DemoCard title="Vertical" description="Vertical orientation for sidebars">
				<VariantGrid layout="row">
					<TickMarks orientation="vertical" count={11} />
					<TickMarks orientation="vertical" count={21} majorEvery={10} majorHeight={16} />
				</VariantGrid>
			</DemoCard>

			<DemoCard title="Density" description="Sparse (gap=20) vs dense (gap=6)">
				<div class="tick-stack">
					<div class="tick-row">
						<span class="motif-label">sparse</span>
						<TickMarks gap={20} count={11} />
					</div>
					<div class="tick-row">
						<span class="motif-label">dense</span>
						<TickMarks gap={6} count={31} majorEvery={10} />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Custom Heights" description="Short (4/8px) vs tall (8/20px) ticks">
				<div class="tick-stack">
					<div class="tick-row">
						<span class="motif-label">short</span>
						<TickMarks minorHeight={4} majorHeight={8} />
					</div>
					<div class="tick-row">
						<span class="motif-label">tall</span>
						<TickMarks minorHeight={8} majorHeight={20} />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Using CSS variable colors">
				<div class="tick-stack">
					<TickMarks color="var(--color-primary)" opacity={0.6} />
					<TickMarks color="var(--color-success)" opacity={0.6} />
					<TickMarks color="var(--color-warning)" opacity={0.6} />
				</div>
			</DemoCard>
		</div>
	</section>

	<!-- Marquee -->
	<section id="dec-marquee" class="section">
		<h2 class="section-title">Marquee</h2>
		<p class="section-description">Continuously scrolling text strip. CSS-only animation. Hover to pause. Hero textures, skill banners, ticker tapes.</p>

		<div class="demos">
			<DemoCard title="Default" description="Single word repeated at 6% opacity">
				<Marquee items={['VELOCIRAPTOR']} />
			</DemoCard>

			<DemoCard title="Multiple Items" description="Several items with separator">
				<Marquee
					items={['Design', 'Build', 'Ship', 'Iterate', 'Scale']}
					opacity={0.08}
					fontSize="2rem"
					fontWeight={700}
				/>
			</DemoCard>

			<DemoCard title="Directions" description="Left vs right scrolling">
				<div class="marquee-stack">
					<div class="marquee-row">
						<span class="motif-label">left</span>
						<Marquee items={['LEFT', 'SCROLL']} direction="left" opacity={0.08} />
					</div>
					<div class="marquee-row">
						<span class="motif-label">right</span>
						<Marquee items={['RIGHT', 'SCROLL']} direction="right" opacity={0.08} />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Speed" description="Fast (10s) vs slow (60s)">
				<div class="marquee-stack">
					<div class="marquee-row">
						<span class="motif-label">fast</span>
						<Marquee items={['FAST', 'MOTION']} speed={10} opacity={0.08} />
					</div>
					<div class="marquee-row">
						<span class="motif-label">slow</span>
						<Marquee items={['SLOW', 'DRIFT']} speed={60} opacity={0.08} />
					</div>
				</div>
			</DemoCard>

			<DemoCard title="Custom Separators" description="Different visual separators">
				<div class="marquee-stack">
					<Marquee items={['React', 'Svelte', 'Vue', 'Angular']} separator="/" opacity={0.08} fontSize="1.5rem" />
					<Marquee items={['React', 'Svelte', 'Vue', 'Angular']} separator="—" opacity={0.08} fontSize="1.5rem" />
					<Marquee items={['React', 'Svelte', 'Vue', 'Angular']} separator="*" opacity={0.08} fontSize="1.5rem" />
				</div>
			</DemoCard>

			<DemoCard title="Theme Colors" description="Colored text strips">
				<div class="marquee-stack">
					<Marquee items={['DESIGN', 'SYSTEM']} color="var(--color-primary)" opacity={0.12} fontSize="2rem" fontWeight={800} />
					<Marquee items={['SHIP', 'IT']} color="var(--color-success)" opacity={0.12} fontSize="2rem" fontWeight={800} direction="right" />
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

	.shape-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
	}

	.shape-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.divider-stack,
	.asterism-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}

	.divider-row,
	.asterism-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.motif-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: monospace;
	}

	.flourish-container {
		position: relative;
		width: 200px;
		height: 150px;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.flourish-sm {
		width: 160px;
		height: 120px;
	}

	.flourish-lg {
		width: 260px;
		height: 200px;
	}

	.flourish-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.wave-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}

	.wave-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.wave-transition {
		width: 100%;
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.wave-section-top {
		background: var(--color-surface-1);
		padding: var(--spacing-6);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.wave-section-bottom {
		background: var(--color-primary);
		padding: var(--spacing-6);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.wave-section-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-style: italic;
	}

	.wave-section-bottom .wave-section-text {
		color: white;
	}

	/* CornerFrame */
	.frame-demo-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
	}

	.frame-container {
		position: relative;
		width: 160px;
		height: 120px;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.frame-sm {
		width: 120px;
		height: 90px;
	}

	.frame-md {
		width: 200px;
		height: 150px;
	}

	.frame-lg {
		width: 260px;
		height: 200px;
	}

	/* TickMarks */
	.tick-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}

	.tick-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	/* Marquee */
	.marquee-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.marquee-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}
</style>
