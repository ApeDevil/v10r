<script lang="ts">
/**
 * ContrastReadout — empirical WCAG contrast of a covered elevation boundary.
 *
 * Renders a real 2-rung mini-stack (lower fill + the selected rung covering it),
 * then reads the ACTUAL rendered pixels via getComputedStyle and computes the WCAG
 * contrast ratio (sRGB → relative luminance, CR = (L1+.05)/(L2+.05)). It measures
 * the rim of the upper rung against the fill beneath — the "covered boundary" the
 * rim math guarantees ≥3:1. If the rim is switched off (transparent / channel off)
 * it falls back to fill-vs-fill, so toggling Rim off visibly collapses the number.
 *
 * Client-only by construction: getComputedStyle needs a laid-out DOM, so the
 * computation runs in an $effect (never on the server). SSR + first hydration paint
 * render a neutral "Measuring…" placeholder — same on both sides, no mismatch.
 */
import { cn } from '$lib/utils/cn';

interface Props {
	/** Selected upper rung, 1–4. */
	rung: number;
	theme: 'light' | 'dark';
	/** data-palette value; '' = inherit page palette. */
	palette: string;
	/** Whether the Rim channel is on (drives rim-vs-fill measurement + visual). */
	rimOn: boolean;
	/** Authoritative instance owns the aria-live announcement; echoes are aria-hidden. */
	live?: boolean;
	class?: string;
}

let { rung, theme, palette, rimOn, live = true, class: className }: Props = $props();

let upperEl = $state<HTMLElement>();
let lowerEl = $state<HTMLElement>();
let cr = $state<number | null>(null);
let usedRim = $state(true);

const lowerLevel = $derived(Math.max(0, rung - 1));
const pass = $derived(cr !== null && cr >= 3);
const announce = $derived(
	cr === null
		? 'Measuring contrast…'
		: `Elevation ${rung} over ${lowerLevel}: ${usedRim ? 'rim' : 'fill'} contrast ` +
				`${cr.toFixed(2)} to 1, ${pass ? 'passes' : 'fails'} the 3 to 1 minimum.`,
);

// --- colour parsing → sRGB, robust to serialization format ------------------
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function parseColor(str: string): [number, number, number, number] | null {
	const m = str.match(/rgba?\(([^)]+)\)/i);
	if (m) {
		const p = m[1]
			.split(/[,/\s]+/)
			.filter(Boolean)
			.map((v) => Number.parseFloat(v));
		if (p.length >= 3 && p.slice(0, 3).every((v) => !Number.isNaN(v))) {
			return [p[0], p[1], p[2], p[3] ?? 1];
		}
	}
	// Fallback for oklch()/color() serializations: let the canvas normalise to sRGB.
	if (!canvas) {
		canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		ctx = canvas.getContext('2d', { willReadFrequently: true });
	}
	if (!ctx) return null;
	try {
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = str;
		ctx.fillRect(0, 0, 1, 1);
		const d = ctx.getImageData(0, 0, 1, 1).data;
		return [d[0], d[1], d[2], d[3] / 255];
	} catch {
		return null;
	}
}

function relLum([r, g, b]: number[]): number {
	const f = (v: number) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: number[], b: number[]): number {
	const la = relLum(a);
	const lb = relLum(b);
	const hi = Math.max(la, lb);
	const lo = Math.min(la, lb);
	return (hi + 0.05) / (lo + 0.05);
}

$effect(() => {
	// Track config so we re-measure after the tokens re-resolve.
	void rung;
	void theme;
	void palette;
	void rimOn;
	if (!upperEl || !lowerEl) return;

	const up = getComputedStyle(upperEl);
	const low = getComputedStyle(lowerEl);
	const lowerFill = parseColor(low.backgroundColor);

	let upperColor = parseColor(up.borderTopColor);
	let rim = true;
	// Rim off, or a transparent/absent border → the visible separator is fill-vs-fill.
	if (!rimOn || !upperColor || upperColor[3] < 0.5) {
		upperColor = parseColor(up.backgroundColor);
		rim = false;
	}

	if (!upperColor || !lowerFill) {
		cr = null;
		return;
	}
	cr = contrast(upperColor, lowerFill);
	usedRim = rim;
});
</script>

<div class={cn('readout', className)} aria-hidden={live ? undefined : 'true'}>
	<!-- Real rendered swatches, scoped to the current theme/palette; the measurement
	     reads these exact pixels. Presentational, so aria-hidden. -->
	<div
		class={cn('pair', theme === 'dark' && 'dark', !rimOn && 'rim-off')}
		data-palette={palette || undefined}
		aria-hidden="true"
	>
		<div
			class="swatch lower"
			data-elevation={lowerLevel === 0 ? undefined : String(lowerLevel)}
			bind:this={lowerEl}
		>
			<span class="sw-tag">E{lowerLevel}</span>
			<div class="swatch upper" data-elevation={String(rung)} bind:this={upperEl}>
				<span class="sw-tag">E{rung}</span>
			</div>
		</div>
	</div>

	<div class="metric">
		<span class="metric-label">Rim vs. layer below</span>
		{#if cr === null}
			<span class="cr-num cr-idle">—</span>
			<span class="cr-hint">Measuring…</span>
		{:else}
			<span class="cr-num">{cr.toFixed(2)}<span class="cr-x">:1</span></span>
			<span class={cn('badge', pass ? 'badge-pass' : 'badge-fail')}>
				<span class={pass ? 'i-lucide-check' : 'i-lucide-x'} aria-hidden="true"></span>
				{pass ? 'Passes 3:1' : 'Below 3:1'}
			</span>
		{/if}
	</div>

	{#if live}
		<p class="status" role="status" aria-live="polite">{announce}</p>
	{/if}
</div>

<style>
	.readout {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-4) var(--spacing-6);
		width: 100%;
	}

	/* --- rendered measurement swatches (2-rung mini stack) --- */
	.swatch {
		border-width: 1px;
		border-style: solid;
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	/* Only the non-elevated (E0) swatch declares its own colours. */
	.swatch:not([data-elevation]) {
		background: var(--surface-0);
		border-color: var(--color-border);
	}
	.lower {
		padding: var(--spacing-3);
		width: clamp(96px, 30vw, 128px);
	}
	.upper {
		padding: var(--spacing-3);
	}
	.sw-tag {
		font-family: 'Fira Code', monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* Rim off → drop the visible rim on the measured swatch so it matches the number. */
	.pair.rim-off .swatch[data-elevation] {
		border-color: transparent;
	}

	/* --- numeric metric --- */
	.metric {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 8rem;
	}
	.metric-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.cr-num {
		font-family: 'Fira Code', monospace;
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		color: var(--color-fg);
		line-height: 1;
	}
	.cr-idle {
		color: var(--color-muted);
	}
	.cr-x {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
	.cr-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		width: fit-content;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
	}
	.badge-pass {
		background: var(--color-success-light);
		color: var(--color-success-fg);
	}
	.badge-fail {
		background: var(--color-error-light);
		color: var(--color-error-fg);
	}

	/* aria-live status line — reserve height so updates never shift layout. */
	.status {
		flex: 1 1 14rem;
		min-height: 2.5rem;
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.4;
	}
</style>
