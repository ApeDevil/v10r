<script lang="ts">
import { Asterism, CornerFrame, Divider } from '$lib/components';
import LogoHero from '$lib/components/branding/LogoHero.svelte';
import { localizeHref } from '$lib/i18n';
import { getStyle } from '$lib/state/style.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { fadeIn } from './_components/fadeIn';
import InstancesSection from './_components/InstancesSection.svelte';
import StructureSection from './_components/StructureSection.svelte';

const style = getStyle();
const theme = getTheme();

type ToggleMode = 'light' | 'dark';
const themeIcons: Record<ToggleMode, string> = { light: 'i-lucide-sun', dark: 'i-lucide-moon' };
const themeLabels: Record<ToggleMode, string> = { light: 'light', dark: 'dark' };

const displayMode: ToggleMode = $derived(theme.resolvedMode === 'dark' ? 'dark' : 'light');

function cycleTheme() {
	theme.setMode(displayMode === 'light' ? 'dark' : 'light');
}

let revealed = $state(false);

$effect(() => {
	revealed = true;
});

const specimenName = 'Velociraptor';

const zones: Array<{
	name: string;
	capabilities: Array<{ icon: string; label: string; desc: string }>;
}> = [
	{
		name: 'RUNTIME',
		capabilities: [
			{ icon: 'i-lucide-zap', label: 'Runtime', desc: 'Bun' },
			{ icon: 'i-lucide-container', label: 'Containers', desc: 'Podman (rootless)' },
			{ icon: 'i-lucide-rocket', label: 'Deployment', desc: 'Vercel / Netlify' },
		],
	},
	{
		name: 'STRUCTURE',
		capabilities: [
			{ icon: 'i-lucide-blocks', label: 'Full-stack Framework', desc: 'SvelteKit 2' },
			{ icon: 'i-lucide-sparkles', label: 'Reactive UI', desc: 'Svelte 5 runes' },
			{ icon: 'i-lucide-check-check', label: 'Lint & Format', desc: 'Biome' },
		],
	},
	{
		name: 'DATA',
		capabilities: [
			{ icon: 'i-lucide-database', label: 'Relational DB', desc: 'PostgreSQL via Neon' },
			{ icon: 'i-lucide-share-2', label: 'Graph DB', desc: 'Neo4j Aura' },
			{ icon: 'i-lucide-layers', label: 'Type-safe ORM', desc: 'Drizzle' },
			{ icon: 'i-lucide-cloud', label: 'Object Storage', desc: 'Cloudflare R2' },
		],
	},
	{
		name: 'INTERFACE',
		capabilities: [
			{ icon: 'i-lucide-paintbrush', label: 'Atomic CSS', desc: 'UnoCSS' },
			{ icon: 'i-lucide-component', label: 'Headless UI', desc: 'Bits UI' },
			{ icon: 'i-lucide-box', label: '3D Rendering', desc: 'Three.js + Threlte' },
		],
	},
	{
		name: 'BEHAVIOR',
		capabilities: [
			{ icon: 'i-lucide-shield', label: 'Session Auth', desc: 'Better Auth' },
			{ icon: 'i-lucide-file-check', label: 'Form Validation', desc: 'Superforms + Valibot' },
			{ icon: 'i-lucide-languages', label: 'Compiled i18n', desc: 'Paraglide' },
		],
	},
	{
		name: 'INTELLIGENCE',
		capabilities: [
			{ icon: 'i-lucide-brain', label: 'LLM Integration', desc: 'Vercel AI SDK' },
			{ icon: 'i-lucide-network', label: 'Graph RAG', desc: 'Recursive retrieval' },
		],
	},
];

const ghostIcons = [
	'i-lucide-cpu',
	'i-lucide-palette',
	'i-lucide-lock',
	'i-lucide-globe',
	'i-lucide-terminal',
	'i-lucide-database',
	'i-lucide-zap',
	'i-lucide-layers',
	'i-lucide-eye',
	'i-lucide-sparkles',
];
</script>

<svelte:head>
	<title>Velociraptor — v10r</title>
</svelte:head>

<!-- ACT I: Hero -->
<section class="hero" class:hero-revealed={revealed}>
	<div class="hero-grid">
		<div class="hero-identity">
			<p class="classification">born to be fast & light</p>

			<h1 class="specimen-name" class:revealed>
				{#each specimenName as char, i}
					<span class="char" style="animation-delay: {i * 15}ms">{char}</span>
				{/each}
			</h1>

			<p class="tagline">Instantiate Through Emulation</p>

			<div class="etymology-card">
				<CornerFrame variant="bracket" size={20} strokeWidth={1} />
				<span class="etymology-label">ETYMOLOGY</span>
				<div class="etymology-content">
					<pre class="etymology-diagram" aria-hidden="true">v  e l o c i r a p t o   r
│ └──── 10 letters ────┘ │
v          10            r</pre>
					<span class="sr-only">The letters v and r bracket 10 letters in Velociraptor, forming the abbreviation v10r.</span>
					<p class="etymology-descriptor">Containerized Full-Stack Pattern Library</p>
				</div>
			</div>
		</div>

		<div class="hero-experience">
			<div class="hero-raptor">
				<LogoHero />
			</div>

			{#if !style.branded}
				<div class="roll-block">
					<p class="roll-label">{style.paletteName} · {style.typographyName}</p>
					<div class="roll-actions">
						<button
							class="roll-btn focus-ring"
							onclick={() => style.roll()}
							disabled={style.rolling}
							aria-label="Randomize site style"
						>
							<span class="roll-icon i-lucide-dices"></span>
							<span>{style.rollCount === 0 ? 'roll a new look' : 'roll again'}</span>
						</button>
						<button
							class="theme-btn focus-ring"
							onclick={cycleTheme}
							aria-label="Theme: {themeLabels[displayMode]}"
						>
							<span class="roll-icon {themeIcons[displayMode]}"></span>
							<span>{themeLabels[displayMode]}</span>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- ACT II: Capability Taxonomy -->
<div class="divider-wrap">
	<Divider motif="crosshair" width="content" />
</div>

<section class="taxonomy">
	<header class="taxonomy-header">
		<h2 class="taxonomy-title">CAPABILITY TAXONOMY</h2>
		<p class="taxonomy-subtitle">A combinable technology set — lightweight and fast, documented and tested</p>
	</header>

	<div class="taxonomy-grid">
		{#each zones as zone, i}
			<article class="zone-card" use:fadeIn={{ delay: i * 60, translate: 8 }}>
				<header class="zone-header">
					<h3 class="zone-name">
						{zone.name}
					</h3>
				</header>
				<ul class="zone-capabilities">
					{#each zone.capabilities as cap}
						<li class="capability">
							<span class="capability-icon {cap.icon}"></span>
							<div>
								<span class="capability-label">{cap.label}</span>
								<span class="capability-desc">{cap.desc}</span>
							</div>
						</li>
					{/each}
				</ul>
			</article>
		{/each}
	</div>
</section>

<!-- ACT III: Instances -->
<div class="divider-wrap">
	<Divider motif="crosshair" width="content" />
</div>

<InstancesSection />

<!-- ACT IV: Internal Structure -->
<div class="divider-wrap">
	<Divider motif="crosshair" width="content" />
</div>

<StructureSection />

<!-- ACT V: Showcase Entry -->
<div class="asterism-wrap">
	<Asterism pattern="three-dots" />
</div>

<section class="showcase-entry">
	<a href={localizeHref('/showcases')} class="cta-link focus-ring">
		<span class="cta-arrow">→</span>
		<span>explore the showcases</span>
	</a>

	<div class="ghost-grid" aria-hidden="true">
		{#each ghostIcons as icon}
			<span class="ghost-icon {icon}"></span>
		{/each}
	</div>
</section>

<style>
	/* ─── TYPOGRAPHY ─── */
	.classification {
		font-family: var(--font-heading, system-ui, sans-serif);
	}

	.etymology-label,
	.etymology-diagram,
	.taxonomy-title,
	.zone-name,
	.cta-link {
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	.specimen-name {
		font-family: var(--font-heading, system-ui, sans-serif);
	}

	.tagline {
		font-family: var(--font-body, system-ui, sans-serif);
	}

	/* ─── ACT I: HERO ─── */
	.hero {
		min-height: 100svh;
		display: flex;
		align-items: center;
		padding: var(--spacing-fluid-4) var(--spacing-fluid-3);
	}

	.hero-grid {
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
	}

	@media (min-width: 1024px) {
		.hero-grid {
			flex-direction: row;
			align-items: center;
			gap: var(--spacing-8);
		}
	}

	/* Block 1: Identity */
	.hero-identity {
		display: flex;
		flex-direction: column;
		flex: 3;
		min-width: 0;
	}

	/* Block 2: Experience */
	.hero-experience {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-6);
		flex: 2;
		min-width: 0;
	}

	.classification {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-variant: small-caps;
		margin: 0 0 var(--spacing-4);
	}

	/* Specimen name */
	.specimen-name {
		font-size: clamp(2rem, 5.5vw, 6rem);
		font-weight: 700;
		text-transform: uppercase;
		line-height: 0.9;
		margin: 0;
		white-space: nowrap;
		color: var(--color-fg);
	}

	.char {
		display: inline-block;
		opacity: 0;
		filter: blur(8px);
		transform: translateY(0.15em);
	}

	.revealed .char {
		animation: char-snap 150ms ease-out forwards;
	}

	@keyframes char-snap {
		to {
			opacity: 1;
			filter: blur(0);
			transform: translateY(0);
		}
	}

	/* Hero entrance choreography — four legs converging on the title */
	.hero .classification,
	.hero .tagline,
	.hero .hero-experience,
	.hero .etymology-card {
		opacity: 0;
	}

	@keyframes hero-enter-from-top {
		from { opacity: 0; transform: translateY(-16px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@keyframes hero-enter-from-bottom {
		from { opacity: 0; transform: translateY(16px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@keyframes hero-enter-from-left {
		from { opacity: 0; transform: translateX(-32px); }
		to   { opacity: 1; transform: translateX(0); }
	}
	@keyframes hero-enter-from-right {
		from { opacity: 0; transform: translateX(32px); }
		to   { opacity: 1; transform: translateX(0); }
	}
	@keyframes hero-enter-vertical {
		from { opacity: 0; transform: translateY(-12px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.hero-revealed .classification {
		animation: hero-enter-from-top 240ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both;
	}
	.hero-revealed .tagline {
		animation: hero-enter-from-bottom 240ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
	}
	.hero-revealed .hero-experience {
		animation: hero-enter-from-left 280ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both;
	}
	.hero-revealed .etymology-card {
		animation: hero-enter-from-right 280ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both;
	}

	@media (max-width: 1023px) {
		.hero-revealed .classification {
			animation: hero-enter-vertical 240ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
		}
		.hero-revealed .tagline {
			animation: hero-enter-vertical 240ms cubic-bezier(0.16, 1, 0.3, 1) 280ms both;
		}
		.hero-revealed .hero-experience {
			animation: hero-enter-vertical 280ms cubic-bezier(0.16, 1, 0.3, 1) 360ms both;
		}
		.hero-revealed .etymology-card {
			animation: hero-enter-vertical 280ms cubic-bezier(0.16, 1, 0.3, 1) 440ms both;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.char {
			opacity: 1;
			filter: none;
			transform: none;
		}
		.revealed .char {
			animation: none;
		}
		.hero .classification,
		.hero .tagline,
		.hero .hero-experience,
		.hero .etymology-card {
			opacity: 1;
			animation: none;
		}
	}

	.tagline {
		font-size: var(--text-fluid-xl);
		color: var(--color-muted);
		margin: var(--spacing-4) 0 var(--spacing-7);
		font-weight: 400;
	}

	/* Roll block */
	.roll-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
	}

	.roll-actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.roll-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-3);
		min-height: 44px;
		padding: var(--spacing-3) var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		background: transparent;
		cursor: pointer;
		transition: border-color var(--duration-fast) ease-out, background-color var(--duration-fast) ease-out;
		position: relative;
		overflow: hidden;
	}

	.roll-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: 1px;
		background: conic-gradient(
			from var(--glow-angle, 0deg),
			transparent 0%,
			transparent 30%,
			var(--color-primary) 45%,
			transparent 60%,
			transparent 100%
		);
		mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
		mask-composite: exclude;
		-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		opacity: 0.5;
		animation: border-sweep 4s linear infinite;
		pointer-events: none;
	}

	@property --glow-angle {
		syntax: '<angle>';
		initial-value: 0deg;
		inherits: false;
	}

	@keyframes border-sweep {
		to {
			--glow-angle: 360deg;
		}
	}

	.roll-btn:hover {
		border-color: var(--color-fg);
		background: var(--color-fg-alpha);
	}

	.roll-btn:hover::before {
		opacity: 0.8;
	}

	.roll-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.roll-btn:disabled::before {
		animation-play-state: paused;
	}

	.roll-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.theme-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-3);
		min-height: 44px;
		padding: var(--spacing-3) var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		background: transparent;
		cursor: pointer;
		transition: border-color var(--duration-fast) ease-out, background-color var(--duration-fast) ease-out, color var(--duration-fast) ease-out;
	}

	.theme-btn:hover {
		border-color: var(--color-fg);
		color: var(--color-fg);
		background: var(--color-fg-alpha);
	}

	.roll-label {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		letter-spacing: 0.1em;
		margin: 0;
	}

	/* Etymology card */
	.etymology-card {
		position: relative;
		border: 1px solid var(--color-fg);
		padding: var(--spacing-6) var(--spacing-5);
		max-width: 24rem;
	}

	.etymology-label {
		position: absolute;
		top: -0.6em;
		left: var(--spacing-4);
		background: var(--color-bg);
		padding: 0 var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.etymology-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.etymology-diagram {
		font-size: clamp(0.5rem, 2.5vw, 0.875rem);
		color: var(--color-muted);
		margin: 0;
		white-space: pre;
		line-height: 1.4;
	}

	.etymology-descriptor {
		font-family: var(--font-body, system-ui, sans-serif);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		margin: 0;
		letter-spacing: 0.05em;
	}

	/* Raptor */
	.hero-raptor {
		width: 100%;
		max-width: 280px;
	}

	/* ─── DIVIDERS ─── */
	.divider-wrap,
	.asterism-wrap {
		padding: var(--spacing-8) var(--spacing-fluid-3);
		display: flex;
		justify-content: center;
	}

	/* ─── ACT II: TAXONOMY ─── */
	.taxonomy {
		padding: var(--spacing-5) var(--spacing-fluid-3) var(--spacing-8);
		max-width: 80rem;
		margin: 0 auto;
	}

	.taxonomy-header {
		text-align: center;
		margin-bottom: var(--spacing-7);
	}

	.taxonomy-title {
		font-size: var(--text-fluid-base);
		letter-spacing: 0.2em;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2);
	}

	.taxonomy-subtitle {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	.taxonomy-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-6);
	}

	@media (min-width: 640px) {
		.taxonomy-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.taxonomy-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	/* Zone cards */
	.zone-card {
		border: 1px solid var(--color-border);
		padding: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		transition: border-color var(--duration-fast) ease-out;
	}

	.zone-card:hover {
		border-color: var(--color-primary);
	}

	.zone-header {
		border-bottom: 1px solid var(--color-border);
		padding-bottom: var(--spacing-3);
	}

	.zone-name {
		font-size: var(--text-fluid-xs);
		letter-spacing: 0.15em;
		color: var(--color-fg);
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.zone-capabilities {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.capability {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
	}

	.capability-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		color: var(--color-fg);
		margin-top: 2px;
	}

	.capability-label {
		font-weight: 600;
		color: var(--color-fg);
	}

	.capability-desc {
		color: var(--color-muted);
		margin-left: var(--spacing-2);
	}

	/* ─── ACT IV: SHOWCASE ENTRY ─── */
	.showcase-entry {
		padding: var(--spacing-7) var(--spacing-fluid-3) var(--spacing-8);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-7);
	}

	.cta-link {
		font-size: var(--text-fluid-2xl);
		color: var(--color-primary);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-3);
		position: relative;
		letter-spacing: 0.05em;
	}

	.cta-link::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		width: 0;
		height: 1px;
		background: currentColor;
		transition: width var(--duration-normal) ease-out;
	}

	.cta-link:hover::after {
		width: 100%;
	}

	.cta-arrow {
		display: inline-block;
		transition: transform var(--duration-normal) ease-out;
	}

	.cta-link:hover .cta-arrow {
		transform: translateX(4px);
	}

	@media (prefers-reduced-motion: reduce) {
		.cta-link::after {
			transition: none;
		}
		.cta-arrow {
			transition: none;
		}
	}

	/* Ghost grid */
	.ghost-grid {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: var(--spacing-6);
		width: 100%;
		max-width: 40rem;
		pointer-events: none;
	}

	.ghost-icon {
		width: 2rem;
		height: 2rem;
		opacity: 0.08;
		justify-self: center;
	}

</style>
