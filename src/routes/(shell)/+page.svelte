<script lang="ts">
import { Asterism, CornerFrame, Divider } from '$lib/components';
import { localizeHref } from '$lib/i18n';
import AsciiRaptor from './_components/AsciiRaptor.svelte';
import { fadeIn } from './_components/fadeIn';
import StructureSection from './_components/StructureSection.svelte';

let revealed = $state(false);

$effect(() => {
	revealed = true;
});

const specimenName = 'Velociraptor';

const zones: Array<{
	name: string;
	proven?: boolean;
	capabilities: Array<{ icon: string; label: string; desc: string }>;
}> = [
	{
		name: 'RUNTIME',
		capabilities: [
			{ icon: 'i-lucide-rabbit', label: 'Bun', desc: 'JavaScript runtime & toolkit' },
			{ icon: 'i-lucide-container', label: 'Podman', desc: 'Rootless containers' },
			{ icon: 'i-lucide-triangle', label: 'Vercel', desc: 'Edge deployment' },
		],
	},
	{
		name: 'STRUCTURE',
		capabilities: [
			{ icon: 'i-lucide-blocks', label: 'SvelteKit 2', desc: 'Full-stack framework' },
			{ icon: 'i-lucide-flame', label: 'Svelte 5', desc: 'Runes reactivity' },
			{ icon: 'i-lucide-scan-search', label: 'Biome', desc: 'Lint & format' },
		],
	},
	{
		name: 'DATA',
		capabilities: [
			{ icon: 'i-lucide-database', label: 'PostgreSQL', desc: 'Neon serverless' },
			{ icon: 'i-lucide-git-fork', label: 'Neo4j', desc: 'Graph database' },
			{ icon: 'i-lucide-layers', label: 'Drizzle', desc: 'Type-safe ORM' },
			{ icon: 'i-lucide-cloud', label: 'Cloudflare R2', desc: 'Object storage' },
		],
	},
	{
		name: 'INTERFACE',
		capabilities: [
			{ icon: 'i-lucide-paintbrush', label: 'UnoCSS', desc: 'Atomic CSS engine' },
			{ icon: 'i-lucide-component', label: 'Bits UI', desc: 'Headless primitives' },
			{ icon: 'i-lucide-box', label: 'Three.js', desc: '3D rendering' },
		],
	},
	{
		name: 'BEHAVIOR',
		proven: true,
		capabilities: [
			{ icon: 'i-lucide-shield', label: 'Better Auth', desc: 'Session-based auth' },
			{ icon: 'i-lucide-file-check', label: 'Superforms', desc: 'Form validation' },
			{ icon: 'i-lucide-languages', label: 'Paraglide', desc: 'Compiled i18n' },
		],
	},
	{
		name: 'INTELLIGENCE',
		capabilities: [
			{ icon: 'i-lucide-brain', label: 'AI SDK', desc: 'Vendor-agnostic LLM' },
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
<section class="hero">
	<div class="hero-grid">
		<div class="hero-content">
			<p class="classification">born to be fast & light</p>

			<h1 class="specimen-name" class:revealed>
				{#each specimenName as char, i}
					<span class="char" style="animation-delay: {i * 15}ms">{char}</span>
				{/each}
			</h1>

			<p class="tagline">Full-Stack Containerized Template</p>

			<div class="etymology-card">
				<CornerFrame variant="bracket" size={20} strokeWidth={1} />
				<span class="etymology-label">ETYMOLOGY</span>
				<div class="etymology-content">
					<pre class="etymology-diagram" aria-hidden="true">v  e l o c i r a p t o   r
│ └──── 10 letters ────┘ │
v          10            r</pre>
					<span class="sr-only">The letters v and r bracket 10 letters in Velociraptor, forming the abbreviation v10r.</span>
					<p class="etymology-result">v10r</p>
				</div>
			</div>
		</div>

		<div class="hero-raptor">
			<AsciiRaptor />
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
		<p class="taxonomy-subtitle">Documented, tested, and deployed</p>
	</header>

	<div class="taxonomy-grid">
		{#each zones as zone}
			<article class="zone-card" class:zone-card--wide={zone.name === 'INTELLIGENCE'} use:fadeIn>
				<header class="zone-header">
					<h3 class="zone-name">
						{zone.name}
						{#if zone.proven}
							<span class="proven-badge">★ PROVEN</span>
						{/if}
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

<!-- ACT III: Internal Structure -->
<div class="divider-wrap">
	<Divider motif="crosshair" width="content" />
</div>

<StructureSection />

<!-- ACT IV: Showcase Entry -->
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
	.classification,
	.specimen-name,
	.etymology-label,
	.etymology-diagram,
	.etymology-result,
	.taxonomy-title,
	.zone-name,
	.proven-badge,
	.cta-link {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
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
			display: grid;
			grid-template-columns: 3fr 2fr;
			align-items: center;
		}
	}

	.hero-content {
		display: flex;
		flex-direction: column;
	}

	/* Classification row */
	.classification {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		font-variant: small-caps;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-5);
	}

	.classification-sep {
		opacity: 0.4;
	}

	/* Specimen name */
	.specimen-name {
		font-size: clamp(3rem, 7.5vw, 6rem);
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

	@media (prefers-reduced-motion: reduce) {
		.char {
			opacity: 1;
			filter: none;
			transform: none;
		}
		.revealed .char {
			animation: none;
		}
	}

	/* Tagline */
	.tagline {
		font-size: var(--text-fluid-lg);
		color: var(--color-muted);
		margin: var(--spacing-3) 0 var(--spacing-7);
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

	.etymology-result {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		color: var(--color-fg);
		margin: 0;
	}

	/* Raptor */
	.hero-raptor {
		display: flex;
		justify-content: center;
		opacity: 0.6;
		color: var(--color-fg);
	}

	@media (min-width: 1024px) {
		.hero-raptor {
			justify-content: flex-end;
		}
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

	.zone-card--wide {
		grid-column: span 2;
	}

	@media (max-width: 1023px) {
		.zone-card--wide {
			grid-column: span 1;
		}
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

	.proven-badge {
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		padding: 1px 6px;
		border: 1px solid;
		line-height: 1.6;
	}

	:global(:root) .proven-badge {
		color: #a07800;
		border-color: #a07800;
	}

	:global(.dark) .proven-badge {
		color: #ffd700;
		border-color: #ffd700;
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
		color: var(--color-fg);
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

	@media (forced-colors: active) {
		.hero-raptor {
			opacity: 1;
		}
	}
</style>
