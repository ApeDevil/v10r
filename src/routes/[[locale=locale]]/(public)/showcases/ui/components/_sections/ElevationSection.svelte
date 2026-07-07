<script lang="ts">
/**
 * Surface (Tonal) Elevation showcase — a self-documenting demo of the REAL
 * production tokens in src/app.css. Nothing here reinvents the system: every band
 * carries `data-elevation="N"` and consumes the shipped surface-N / eN-N tokens.
 *
 * Depth = three independent channels, each toggleable below:
 *   1. Rim   — the load-bearing --eN-border staircase (≥3:1 at every covered edge).
 *   2. Glow  — a decorative brand-tinted --eN-shadow bloom that grows with the rung
 *              (a primary-tinted drop in light, an emanating bloom in dark).
 *   3. Fill  — the tonal --eN-bg surface, climbing to pure white/black at E4.
 *
 * The last card proves the RELATIVE engine: real <Surface> components auto-increment
 * one rung per nesting level (parent + 1) with no numbers — the production mechanism.
 *
 * Theme + palette are scoped LOCALLY (the app's own `.dark` class + `data-palette`
 * attribute stamped on each stage), so the demo never fights the page's theme FAB.
 */
import { Button, Cluster, Dialog, Select, Surface, Switch, ToggleGroup } from '$lib/components';
import { ContrastReadout, DemoCard, RungStack } from '../_components';
import type { Rung } from '../_components/RungStack.svelte';

// ── Didactic layer mapping: 5 named surfaces across E0–E4 ──────────────────────
const LADDER: Rung[] = [
	{ e: 0, role: 'Background', token: 'surface-0' },
	{ e: 1, role: 'Sidebar', token: 'surface-1' },
	{ e: 2, role: 'Card', token: 'surface-2' },
	{ e: 3, role: 'Dialog', token: 'e3-bg' },
	{ e: 4, role: 'Tooltip', token: 'surface-3' },
];
// Never-skip mini-stages
const SKIP: Rung[] = [
	{ e: 0, role: 'Background', token: 'surface-0' },
	{ e: 2, role: 'Card', token: 'surface-2' },
];
const STEP: Rung[] = [
	{ e: 0, role: 'Background', token: 'surface-0' },
	{ e: 1, role: 'Sidebar', token: 'surface-1' },
	{ e: 2, role: 'Card', token: 'surface-2' },
];
// Palette gauntlet — a few distinct hues to prove the rim/glow are hue-neutral.
const GAUNTLET = [
	{ p: 'P1', name: 'Ocean' },
	{ p: 'P2', name: 'Sunset' },
	{ p: 'P3', name: 'Forest' },
	{ p: 'P4', name: 'Neon Lime' },
	{ p: 'P6', name: 'Terracotta' },
	{ p: 'P7', name: 'Midnight' },
];

// ── Control options ────────────────────────────────────────────────────────────
const PALETTES = [
	{ value: 'auto', label: 'Auto (page palette)' },
	{ value: 'P0', label: 'P0 · High Contrast' },
	{ value: 'P1', label: 'P1 · Ocean' },
	{ value: 'P2', label: 'P2 · Sunset' },
	{ value: 'P3', label: 'P3 · Forest' },
	{ value: 'P4', label: 'P4 · Neon Lime' },
	{ value: 'P5', label: 'P5 · Deep Violet' },
	{ value: 'P6', label: 'P6 · Terracotta' },
	{ value: 'P7', label: 'P7 · Midnight' },
];
const VISIONS = [
	{ value: 'none', label: 'Normal vision' },
	{ value: 'grayscale', label: 'Grayscale (mono)' },
	{ value: 'blur', label: 'Low-contrast blur' },
	{ value: 'forced', label: 'Forced-colors (approx.)' },
];
const RUNGS = [
	{ value: '1', label: 'E1' },
	{ value: '2', label: 'E2' },
	{ value: '3', label: 'E3' },
	{ value: '4', label: 'E4' },
];

// ── Section-level control state (Svelte 5 runes) ────────────────────────────────
let dark = $state(false);
let paletteSel = $state('auto');
let rungStr = $state('2'); // string for ToggleGroup's bindable contract
let correct = $state(true);
let visionSel = $state('none');
let channels = $state({ rim: true, glow: true, fill: true });
let dialogOpen = $state(false);

const theme = $derived(dark ? 'dark' : 'light');
const palette = $derived(paletteSel === 'auto' ? '' : paletteSel);
const rung = $derived(Number(rungStr));
const vision = $derived(visionSel as 'none' | 'grayscale' | 'blur' | 'forced');
</script>

<section id="elevation" class="section elevation-showcase">
	<h2 class="section-title">Surface Elevation</h2>
	<p class="section-description">
		Tonal depth built from three independent channels on <code>[data-elevation]</code> —
		a load-bearing <strong>rim</strong>, a decorative brand-tinted <strong>glow</strong>, and the
		tonal <strong>fill</strong>. The demo maps five named surfaces onto the rungs: Background (E0)
		▸ Sidebar (E1) ▸ Card (E2) ▸ Dialog (E3) ▸ Tooltip (E4). One rule holds throughout — a layer
		sits <strong>exactly one rung</strong> above what it covers and never skips a level — and the
		last card shows real <code>&lt;Surface&gt;</code> components enforcing it automatically.
	</p>

	<div class="demos">
		<!-- Card 0 — Playground controls -->
		<DemoCard
			title="Elevation Playground"
			description="Every widget writes shared state consumed by the stages below."
		>
			<div class="controls">
				<Cluster gap="6" align="start">
					<div class="ctl">
						<span class="ctl-label">Theme</span>
						<Switch label="Dark mode" bind:checked={dark} />
					</div>
					<div class="ctl">
						<span class="ctl-label">Palette</span>
						<div class="ctl-widget"><Select options={PALETTES} bind:value={paletteSel} /></div>
					</div>
					<div class="ctl">
						<span class="ctl-label">Elevation rung</span>
						<ToggleGroup type="single" items={RUNGS} bind:value={rungStr} size="lg" />
					</div>
					<div class="ctl">
						<span class="ctl-label">Channels</span>
						<div class="switch-col">
							<Switch label="Rim (border)" bind:checked={channels.rim} />
							<Switch label="Brand glow" bind:checked={channels.glow} />
							<Switch label="Fill (tone)" bind:checked={channels.fill} />
						</div>
					</div>
					<div class="ctl">
						<span class="ctl-label">Comparison</span>
						<Switch label="Prefer correct stepping" bind:checked={correct} />
					</div>
					<div class="ctl">
						<span class="ctl-label">Vision sim</span>
						<div class="ctl-widget"><Select options={VISIONS} bind:value={visionSel} /></div>
					</div>
				</Cluster>

				<div class="readout-row">
					<ContrastReadout {rung} {theme} {palette} rimOn={channels.rim} live />
				</div>
			</div>
		</DemoCard>

		<!-- Card 1 — Elevation Ladder (hero) -->
		<DemoCard
			title="Elevation Ladder"
			description="Five surfaces nested one rung apart. Turn Rim off in dark mode to watch the staircase collapse."
		>
			<div class="ladder-container">
				<div class="ladder-wrap">
					<RungStack hero rungs={LADDER} {theme} {palette} {channels} {vision} selected={rung} />
					<div class="ladder-aside">
						<ContrastReadout {rung} {theme} {palette} rimOn={channels.rim} live={false} />
						<div class="real-dialog">
							<Button variant="outline" onclick={() => (dialogOpen = true)}>
								Open a real dialog
							</Button>
							<p class="aside-note">
								The Dialog/Tooltip chips in the stage are static, unlabelled divs — they only carry
								a text chip, never a lying <code>role</code>. This button opens the genuine article:
								it portals, traps focus and returns focus to the trigger. Opened from the page plane
								it resolves to <strong>E1</strong> via <code>useSurface()</code> — its scrim, not its
								tone, carries the separation.
							</p>
						</div>
					</div>
				</div>
			</div>
		</DemoCard>

		<!-- Card 2 — Rung Inspector: light vs dark, side by side -->
		<DemoCard
			title="Rung Inspector · Light vs Dark"
			description="Two token-islands render simultaneously so the glow polarity flip is visible at once — pure CSS, no media-query hydration branch."
		>
			<div class="inspector">
				{#snippet pane(cls: string, name: string)}
					<div class={`ins-pane ${cls}`}>
						<span class="ins-mode">{name}</span>
						{#each LADDER as r (r.e)}
							<div class="ins-swatch" data-elevation={r.e === 0 ? undefined : String(r.e)}>
								<span class="chip">
									<span class="chip-e">E{r.e}</span>
									<span class="chip-role">{r.role}</span>
									<code class="chip-token">{r.token}</code>
								</span>
							</div>
						{/each}
					</div>
				{/snippet}
				<div class="inspector-grid">
					{@render pane('force-light', 'Light')}
					{@render pane('dark', 'Dark')}
				</div>
			</div>
		</DemoCard>

		<!-- Card 3 — Never skip levels -->
		<DemoCard
			title="Never Skip Levels"
			description="A coverer must sit exactly one rung above what it covers. Toggle “Prefer correct stepping” to spotlight the right pattern."
		>
			<div class="skip-grid">
				<figure class={`mini-fig ${correct ? 'is-dim' : 'is-active'}`}>
					<RungStack rungs={SKIP} {theme} {palette} {channels} {vision} />
					<figcaption class="fig-bad">
						<span class="i-lucide-x" aria-hidden="true"></span>
						<span>
							<strong>Skipped.</strong> E0 jumps straight to E2 with no E1 between them, so the
							parent–child relationship is ambiguous. In dark mode a skipped Tooltip can land on
							pure black — tonally identical to the modal beneath it.
						</span>
					</figcaption>
				</figure>
				<figure class={`mini-fig ${correct ? 'is-active' : 'is-dim'}`}>
					<RungStack rungs={STEP} {theme} {palette} {channels} {vision} />
					<figcaption class="fig-good">
						<span class="i-lucide-check" aria-hidden="true"></span>
						<span>
							<strong>Stepped.</strong> E0 → E1 → E2, one rung at a time. Every boundary is a single
							countable step, and the rim clears 3:1 at each edge.
						</span>
					</figcaption>
				</figure>
			</div>
		</DemoCard>

		<!-- Card 4 — Palette gauntlet -->
		<DemoCard
			title="Palette Gauntlet"
			description="The same five-rung stack across several hues — proof the rim and glow are tonal, not chromatic."
		>
			<div class="gauntlet">
				{#each GAUNTLET as g (g.p)}
					<div class="gaunt-tile">
						<span class="gaunt-name">{g.name}</span>
						<RungStack rungs={LADDER} palette={g.p} {theme} {channels} {vision} compact />
					</div>
				{/each}
			</div>
		</DemoCard>

		<!-- Card 5 — Relative auto-increment via the real <Surface> engine -->
		<DemoCard
			title="Relative Auto-Increment · real &lt;Surface&gt;"
			description="No numbers anywhere. Each <Surface> renders one rung above its parent (parent + 1), resolved through Svelte context — the exact production engine. Nesting can never skip a level."
		>
			<div class="rel-demo">
				{#snippet relBand(depth: number)}
					<Surface class="rel-band">
						{#if depth < 4}
							{@render relBand(depth + 1)}
						{/if}
					</Surface>
				{/snippet}
				<div class="rel-plane">
					<span class="rel-plane-tag">app background · level 0 (no &lt;Surface&gt;)</span>
					{@render relBand(1)}
				</div>
				<p class="rel-note">
					The outer plane declares no level. Every nested <code>&lt;Surface&gt;</code> calls
					<code>useSurface()</code>, reads its parent's level from context and stamps
					<code>data-elevation = parent + 1</code> — the badge on each band is its real
					<code>attr(data-elevation)</code>. Delete a layer and the rest renumber themselves; there is
					no hardcoded rung to get wrong. This is the same engine the sidebar, menus and dialogs use.
				</p>
			</div>
		</DemoCard>
	</div>
</section>

<!-- The one authentic modal, deliberately OUTSIDE every diorama. -->
<Dialog
	bind:open={dialogOpen}
	title="A real dialog"
	description="A genuine modal: role=dialog, aria-modal, a focus trap and focus return. Its elevation is resolved relatively by useSurface() — opened from the page plane it lands at E1, and the scrim carries the separation."
>
	<p class="dialog-body">
		Elevation is never the sole carrier of meaning. Under forced-colors the tonal fill and the
		brand glow both vanish and only the rim survives — which is why a modal also announces its
		role and traps focus.
	</p>
</Dialog>

<style>
	/* ── Section shell (mirrors LayoutSection's idiom) ── */
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
		max-width: 70ch;
	}
	.section-description code {
		font-family: 'Fira Code', monospace;
		font-size: 0.9em;
		color: var(--color-fg);
	}
	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	/* ── Card 0 controls ── */
	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}
	.ctl {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.ctl-label {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}
	.ctl-widget {
		min-width: 13rem;
	}
	.switch-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.readout-row {
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
		width: 100%;
	}

	/* ── Card 1 ladder ── */
	.ladder-container {
		container-type: inline-size;
		width: 100%;
	}
	.ladder-wrap {
		display: grid;
		gap: var(--spacing-6);
		width: 100%;
	}
	@container (min-width: 560px) {
		/* When the DemoCard is wide, sit the ladder beside its notes. */
		.ladder-wrap {
			grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.ladder-aside {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}
	.real-dialog {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.aside-note,
	.dialog-body {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}
	.aside-note code {
		font-family: 'Fira Code', monospace;
		color: var(--color-fg);
	}

	/* ── Card 2 inspector ── */
	.inspector {
		container-type: inline-size;
		width: 100%;
	}
	.inspector-grid {
		display: grid;
		gap: var(--spacing-4);
	}
	@container (min-width: 448px) {
		.inspector-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.ins-pane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border-radius: var(--radius-lg);
		background: var(--surface-0);
		border: 1px solid var(--color-border);
	}
	.ins-mode {
		font-size: var(--text-fluid-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}
	.ins-swatch {
		border-width: 1px;
		border-style: solid;
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
	}
	.ins-swatch:not([data-elevation]) {
		background: var(--surface-0);
		border-color: var(--color-border);
	}

	/* force-light: re-declare the base LIGHT token values so the light island stays
	   light even when the page is dark (or on a non-default palette). Direct
	   declarations here out-rank the inherited .dark / [data-palette] values. Mirrors
	   src/app.css :root — kept in sync by hand. The dark island needs no counterpart:
	   the app's own `.dark` class already declares every base dark token directly on
	   the element, overriding any inherited palette. */
	.force-light {
		--color-bg: oklch(0.88 0.015 240);
		--color-fg: oklch(0.35 0.06 210);
		--color-muted: oklch(0.45 0.02 260);
		--color-border: oklch(1 0 0);
		--color-primary: oklch(0.42 0.27 290);
		--surface-1: oklch(0.9 0.01 240);
		--surface-2: oklch(0.94 0.008 240);
		--surface-3: oklch(1 0 0);
		--e1-shadow: 0 1px 3px color-mix(in oklab, var(--glow-rest-hue) 10%, transparent),
			0 0 10px 0 color-mix(in oklab, var(--glow-rest-hue) 5%, transparent);
		--e2-shadow: 0 3px 8px -1px color-mix(in oklab, var(--glow-rest-hue) 12%, transparent),
			0 0 15px 1px color-mix(in oklab, var(--glow-rest-hue) 7%, transparent);
		--e3-shadow: 0 6px 14px -3px color-mix(in oklab, var(--glow-rest-hue) 15%, transparent),
			0 0 20px 2px color-mix(in oklab, var(--glow-rest-hue) 9%, transparent);
		--e4-shadow: 0 10px 20px -5px color-mix(in oklab, var(--glow-rest-hue) 18%, transparent),
			0 0 24px 3px color-mix(in oklab, var(--glow-rest-hue) 11%, transparent);
		/* --glow-rest-hue / --e3-bg / --e4-bg inherit :root's formulas and resolve through this
		   island's own --color-primary / --color-muted / --surface-2/3, so the light drop-glow and
		   the pure-white E4 fill render correctly even on a dark page. */
	}

	.chip {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		max-width: 100%;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
		font-size: var(--text-fluid-xs);
		line-height: 1.4;
		color: var(--color-fg);
	}
	.chip-e {
		font-family: 'Fira Code', monospace;
		font-weight: 700;
	}
	.chip-role {
		font-weight: 600;
		white-space: nowrap;
	}
	.chip-token {
		font-family: 'Fira Code', monospace;
		color: var(--color-muted);
		white-space: nowrap;
	}

	/* ── Card 3 never-skip ── */
	.skip-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
		gap: var(--spacing-5);
		width: 100%;
	}
	.mini-fig {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin: 0;
		padding: var(--spacing-4);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		transition: opacity var(--duration-normal) var(--ease-default);
	}
	.mini-fig.is-active {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}
	.mini-fig.is-dim {
		opacity: 0.6;
	}
	.fig-bad,
	.fig-good {
		display: flex;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
		color: var(--color-muted);
	}
	.fig-bad :global(span[class^='i-lucide']) {
		color: var(--color-error);
		flex-shrink: 0;
		margin-top: 0.15em;
	}
	.fig-good :global(span[class^='i-lucide']) {
		color: var(--color-success);
		flex-shrink: 0;
		margin-top: 0.15em;
	}
	.fig-bad strong,
	.fig-good strong {
		color: var(--color-fg);
	}

	/* ── Card 4 gauntlet ── */
	.gauntlet {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}
	.gaunt-tile {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.gaunt-name {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
	}

	/* ── Card 5 relative auto-increment (real <Surface>) ── */
	.rel-demo {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}
	.rel-plane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: clamp(12px, 3vw, 20px);
		border-radius: var(--radius-lg);
		background: var(--surface-0);
		border: 1px solid var(--color-border);
	}
	.rel-plane-tag {
		font-family: 'Fira Code', monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	/* .rel-band sits on the <Surface> component's own element → needs :global, scoped to the
	   showcase. Border WIDTH/STYLE only here; the rim COLOUR comes from [data-elevation]. */
	:global(.elevation-showcase .rel-band) {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: clamp(10px, 2.5vw, 16px);
		border: 1px solid;
		border-radius: var(--radius-md);
	}
	:global(.elevation-showcase .rel-band)::before {
		content: 'E' attr(data-elevation) '  ·  <Surface>';
		font-family: 'Fira Code', monospace;
		font-size: var(--text-fluid-xs);
		font-weight: 700;
		color: var(--color-fg);
	}
	.rel-note {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}
	.rel-note code {
		font-family: 'Fira Code', monospace;
		color: var(--color-fg);
	}

	/* ── Channel-isolation + forced-colors sim overrides (section-scoped globals) ──
	   Defined once here; RungStack stamps the trigger classes on each stage root.
	   Specificity (0,3,x) intentionally out-ranks app.css's [data-elevation] (0,1,x). */
	:global(.elevation-showcase .rim-off [data-elevation]) {
		border-color: transparent;
	}
	:global(.elevation-showcase .glow-off [data-elevation]) {
		box-shadow: none;
	}
	:global(.elevation-showcase .fill-off [data-elevation]) {
		background: var(--surface-1);
	}
	/* Forced-colors APPROXIMATION (true forced-colors is OS-level): strip fill + glow,
	   force a 1px fg border — echoes what the UA leaves under forced-colors. */
	:global(.elevation-showcase .sim-forced [data-elevation]) {
		background: var(--surface-0);
		box-shadow: none;
		border-color: var(--color-fg);
	}
</style>
