<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { beforeNavigate } from '$app/navigation';
import { cssColorToRgb, getCssVar, onThemeChange } from '$lib/components/viz/_shared/theme-bridge';
import * as m from '$lib/paraglide/messages';
import { PROBE_LANE_LABELS } from '$lib/showcases/ai/labels';
import type { ProbeReport } from '$lib/types/context-probe';
import { layoutGalaxy } from './galaxy-layout';

// The probe report as a constellation: corpora are sectors, candidates are stars
// placed by rank, the dashed ring is the production cutoff. Star positions and
// dust are illustrative (the caveat below says so); panel 2's ranked list stays
// the accessible, factual record — the whole canvas is aria-hidden.
let { report }: { report: ProbeReport } = $props();

const layout = $derived(layoutGalaxy(report));
const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)', false);

let wrapEl = $state<HTMLDivElement | undefined>();
let canvasEl = $state<HTMLCanvasElement | undefined>();
let cw = $state(0);
let ch = $state(0);
let ready = $state(false);
let inView = $state(false);

let ctx: CanvasRenderingContext2D | undefined;
let resizeObs: ResizeObserver | undefined;
let viewObs: IntersectionObserver | undefined;
let unsubTheme: (() => void) | undefined;
let rafId: number | undefined;
let reportStamp = 0;

const GLOW_PX = 12;
const spriteCache = new Map<string, HTMLCanvasElement>();

type Palette = {
	primary: [number, number, number];
	muted: [number, number, number];
	warning: string;
	fg: string;
	border: string;
};
let palette: Palette | undefined;

function getPalette(): Palette {
	if (!palette) {
		palette = {
			primary: cssColorToRgb(getCssVar('color-primary'), '#888'),
			muted: cssColorToRgb(getCssVar('color-muted'), '#888'),
			warning: getCssVar('color-warning'),
			fg: getCssVar('color-fg'),
			border: getCssVar('color-border'),
		};
	}
	return palette;
}

/** Pre-baked radial-gradient glow — never `ctx.filter = 'blur()'` (mobile GPU cost). */
function glowSprite(rgb: [number, number, number], dpr: number): HTMLCanvasElement {
	const key = `${rgb.join(',')}|${dpr}`;
	const cached = spriteCache.get(key);
	if (cached) return cached;
	const size = Math.ceil(GLOW_PX * 2 * dpr);
	const sprite = document.createElement('canvas');
	sprite.width = size;
	sprite.height = size;
	const sctx = sprite.getContext('2d');
	if (sctx) {
		const g = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`);
		g.addColorStop(0.35, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
		g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
		sctx.fillStyle = g;
		sctx.fillRect(0, 0, size, size);
	}
	spriteCache.set(key, sprite);
	return sprite;
}

function draw(now = performance.now(), animate = false) {
	if (!canvasEl || !ctx || cw <= 0 || ch <= 0) return;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const W = Math.round(cw * dpr);
	const H = Math.round(ch * dpr);
	if (canvasEl.width !== W || canvasEl.height !== H) {
		canvasEl.width = W;
		canvasEl.height = H;
	}
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, cw, ch);

	const p = getPalette();
	const cx = cw / 2;
	const cy = ch / 2;
	const R = Math.min(cw, ch) / 2 - 20;
	if (R <= 0) return;

	// Dust — density from real inventory counts, position decorative; slow drift.
	const phase = animate ? ((now % 180000) / 180000) * Math.PI * 2 : 0;
	const cos = Math.cos(phase);
	const sin = Math.sin(phase);
	for (let i = 0; i < layout.dust.length; i++) {
		const d = layout.dust[i];
		const x = d.x * cos - d.y * sin;
		const y = d.x * sin + d.y * cos;
		const twinkle = animate ? 0.85 + 0.15 * Math.sin(now / 900 + i) : 1;
		ctx.globalAlpha = d.alpha * twinkle;
		ctx.fillStyle = `rgb(${p.muted[0]},${p.muted[1]},${p.muted[2]})`;
		ctx.fillRect(cx + x * R, cy + y * R, 1.5, 1.5);
	}
	ctx.globalAlpha = 1;

	// Sector separators + corpus labels; degenerate corpora keep their sector.
	const corpusCount = layout.sectors.length;
	for (const sector of layout.sectors) {
		if (corpusCount > 1) {
			ctx.strokeStyle = p.border;
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.7;
			ctx.beginPath();
			ctx.moveTo(cx + Math.cos(sector.startAngle) * R * 0.12, cy + Math.sin(sector.startAngle) * R * 0.12);
			ctx.lineTo(cx + Math.cos(sector.startAngle) * R, cy + Math.sin(sector.startAngle) * R);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
		const mid = (sector.startAngle + sector.endAngle) / 2;
		const lx = cx + Math.cos(mid) * (R + 10);
		const ly = cy + Math.sin(mid) * (R + 10);
		ctx.font = '11px sans-serif';
		ctx.textAlign = Math.abs(Math.cos(mid)) < 0.3 ? 'center' : Math.cos(mid) > 0 ? 'left' : 'right';
		ctx.textBaseline = Math.sin(mid) > 0.3 ? 'top' : Math.sin(mid) < -0.3 ? 'bottom' : 'middle';
		ctx.fillStyle = p.fg;
		ctx.fillText(PROBE_LANE_LABELS[sector.corpus](), lx, ly);
		if (sector.kind !== 'ran') {
			ctx.fillStyle = `rgb(${p.muted[0]},${p.muted[1]},${p.muted[2]})`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const label = sector.kind === 'skipped' ? m.showcase_ai_probe_galaxy_skipped() : m.showcase_ai_probe_no_hits();
			ctx.fillText(label, cx + Math.cos(mid) * R * 0.55, cy + Math.sin(mid) * R * 0.55);
		}
	}

	// Production cutoff — dashed arc between the last chosen and first passed-over rank.
	const span = (Math.PI * 2) / Math.max(corpusCount, 1);
	const pad = span * 0.08;
	for (const arc of layout.cutoffArcs) {
		const sector = layout.sectors[arc.corpusIndex];
		ctx.strokeStyle = p.warning;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.arc(cx, cy, arc.radius * R, sector.startAngle + pad, sector.endAngle - pad);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// Stars — chosen bright primary, passed-over dimmed (mirrors the list's 55%).
	for (const star of layout.stars) {
		const appear = animate ? Math.min(1, Math.max(0, (now - reportStamp - star.rank * 60) / 400)) : 1;
		if (appear <= 0) continue;
		const rgb = star.chosen ? p.primary : p.muted;
		const alpha = star.brightness * appear * (star.chosen ? 1 : 0.55);
		const px = cx + star.x * R;
		const py = cy + star.y * R;
		const glow = GLOW_PX * (star.r / 3);
		ctx.globalAlpha = alpha;
		ctx.drawImage(glowSprite(rgb, dpr), px - glow, py - glow, glow * 2, glow * 2);
		ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
		ctx.beginPath();
		ctx.arc(px, py, star.r * appear, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}

	// Center glyph — the query.
	ctx.fillStyle = p.fg;
	ctx.beginPath();
	ctx.arc(cx, cy, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = p.border;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, 8, 0, Math.PI * 2);
	ctx.stroke();
	ctx.font = '10px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = `rgb(${p.muted[0]},${p.muted[1]},${p.muted[2]})`;
	ctx.fillText(m.showcase_ai_probe_galaxy_query(), cx, cy + 12);
}

function frame(now: number) {
	draw(now, true);
	rafId = inView && !reducedMotion.current ? requestAnimationFrame(frame) : undefined;
}

function cleanup() {
	resizeObs?.disconnect();
	resizeObs = undefined;
	viewObs?.disconnect();
	viewObs = undefined;
	if (rafId !== undefined) cancelAnimationFrame(rafId);
	rafId = undefined;
	unsubTheme?.();
	unsubTheme = undefined;
	spriteCache.clear();
	ctx = undefined;
}

beforeNavigate(cleanup);
onDestroy(cleanup);

onMount(() => {
	if (!wrapEl || !canvasEl) return;
	ctx = canvasEl.getContext('2d') ?? undefined;

	resizeObs = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (entry) {
			cw = entry.contentRect.width;
			ch = entry.contentRect.height;
		}
	});
	resizeObs.observe(wrapEl);

	// The real battery fix: rAF pauses for background tabs on its own, but not
	// for a visible tab with the canvas scrolled off — that's this observer's job.
	viewObs = new IntersectionObserver(
		(entries) => {
			inView = entries[0]?.isIntersecting ?? false;
		},
		{ rootMargin: '64px' },
	);
	viewObs.observe(wrapEl);

	unsubTheme = onThemeChange(() => {
		palette = undefined;
		spriteCache.clear();
		draw();
	});

	ready = true;
});

// New report → restart the light-up cascade.
// svelte-ignore state_referenced_locally
$effect(() => {
	const _report = report;
	reportStamp = performance.now();
});

// Drive the loop while in view (and motion is allowed); otherwise draw one
// static, fully-settled frame. Reduced motion keeps the picture, drops the drift.
// svelte-ignore state_referenced_locally
$effect(() => {
	const _report = report;
	const _cw = cw;
	const _ch = ch;
	const running = inView && !reducedMotion.current;
	if (!ready || _cw <= 0 || _ch <= 0) return;
	if (running) {
		if (rafId === undefined) rafId = requestAnimationFrame(frame);
	} else {
		if (rafId !== undefined) {
			cancelAnimationFrame(rafId);
			rafId = undefined;
		}
		draw();
	}
});
</script>

<div class="galaxy">
	<div class="canvas-wrap" bind:this={wrapEl} aria-hidden="true">
		<canvas bind:this={canvasEl}></canvas>
	</div>
	<div class="galaxy-foot">
		<ul class="legend" aria-hidden="true">
			<li><span class="swatch swatch-query"></span>{m.showcase_ai_probe_galaxy_query()}</li>
			<li><span class="swatch swatch-chosen"></span>{m.showcase_ai_probe_galaxy_chosen()}</li>
			<li><span class="swatch swatch-passed"></span>{m.showcase_ai_probe_galaxy_passed()}</li>
			<li><span class="swatch swatch-cutoff"></span>{m.showcase_ai_probe_galaxy_cutoff()}</li>
			<li><span class="swatch swatch-dust"></span>{m.showcase_ai_probe_galaxy_dust()}</li>
		</ul>
		<p class="caveat">{m.showcase_ai_probe_galaxy_caveat()}</p>
	</div>
</div>

<style>
	.galaxy {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.canvas-wrap {
		width: 100%;
		aspect-ratio: 16 / 7;
		max-height: 340px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 4%, var(--color-bg));
		overflow: hidden;
	}

	.canvas-wrap canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.galaxy-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.legend {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		margin: 0;
		padding: 0;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.swatch {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.swatch-query {
		background: var(--color-fg);
	}

	.swatch-chosen {
		background: var(--color-primary);
		box-shadow: 0 0 4px color-mix(in srgb, var(--color-primary) 60%, transparent);
	}

	.swatch-passed {
		background: color-mix(in srgb, var(--color-muted) 55%, transparent);
	}

	.swatch-cutoff {
		background: transparent;
		border-radius: 0;
		height: 0;
		border-top: 2px dashed var(--color-warning);
	}

	.swatch-dust {
		width: 0.3rem;
		height: 0.3rem;
		background: color-mix(in srgb, var(--color-muted) 40%, transparent);
	}

	.caveat {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}
</style>
