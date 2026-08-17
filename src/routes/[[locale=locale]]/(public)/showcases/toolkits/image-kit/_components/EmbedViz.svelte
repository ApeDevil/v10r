<script lang="ts">
/**
 * Embedding visualization: a per-dimension heatmap of the raw vector + cosine
 * similarity bars against a fixed concept corpus, with a text/table alternative
 * for screen readers (WCAG 1.4.1 — the colour heatmap never carries meaning alone).
 * A Switch toggles between embedding the AI caption (text) and the actual image
 * (multimodal, preview model). Re-embedding is explicit (no spend on toggle).
 *
 * Not localized: every user-facing string below is a literal or a humanized
 * enum key. The whole file still needs an i18n pass — no per-string markers.
 */
import { browser } from '$app/environment';
import { Alert } from '$lib/components/composites';
import { Badge, Button, Spinner, Switch } from '$lib/components/primitives';
import type { EmbedOk } from '$lib/schemas/showcase/image-kit';

interface Props {
	embed: EmbedOk | null;
	loading: boolean;
	error: string;
	multimodal?: boolean;
	multimodalAvailable: boolean;
	onrun: () => void;
}

let { embed, loading, error, multimodal = $bindable(false), multimodalAvailable, onrun }: Props = $props();

let canvasEl = $state<HTMLCanvasElement | null>(null);

const COLS = 48;

// Resolve ANY CSS color (oklch, hex, rgb, color-mix) to sRGB [r,g,b] by letting the
// browser paint it onto a 1×1 probe canvas and reading the pixel back. The design
// tokens are authored as oklch(), which a naive hex parser silently turns into black —
// so never parse the colour string ourselves.
function cssColorToRgb(color: string, fallback: string): [number, number, number] {
	const probe = document.createElement('canvas').getContext('2d');
	if (!probe) return [128, 128, 128];
	probe.fillStyle = '#000';
	probe.fillStyle = (color || '').trim() || fallback;
	probe.fillRect(0, 0, 1, 1);
	const d = probe.getImageData(0, 0, 1, 1).data;
	return [d[0], d[1], d[2]];
}
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
	const r = Math.round(a[0] + (b[0] - a[0]) * t);
	const g = Math.round(a[1] + (b[1] - a[1]) * t);
	const bl = Math.round(a[2] + (b[2] - a[2]) * t);
	return `rgb(${r}, ${g}, ${bl})`;
}

// Draw the heatmap whenever the vector or the canvas changes.
$effect(() => {
	if (!browser || !canvasEl || !embed?.vector?.length) return;
	const vec = embed.vector;
	const cs = getComputedStyle(canvasEl);
	const zero = cssColorToRgb(cs.getPropertyValue('--color-subtle'), '#e5e7eb');
	const pos = cssColorToRgb(cs.getPropertyValue('--color-primary'), '#3b82f6');
	const neg = cssColorToRgb(cs.getPropertyValue('--color-error'), '#ef4444');

	const rows = Math.ceil(vec.length / COLS);
	const dpr = window.devicePixelRatio || 1;
	const cssW = canvasEl.clientWidth || 480;
	const cell = cssW / COLS;
	const cssH = rows * cell;
	canvasEl.width = Math.round(cssW * dpr);
	canvasEl.height = Math.round(cssH * dpr);
	canvasEl.style.height = `${cssH}px`;

	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;
	ctx.scale(dpr, dpr);
	let maxAbs = 0;
	for (const x of vec) maxAbs = Math.max(maxAbs, Math.abs(x));
	if (maxAbs === 0) maxAbs = 1;

	for (let i = 0; i < vec.length; i++) {
		const t = Math.min(1, Math.abs(vec[i]) / maxAbs);
		ctx.fillStyle = mix(zero, vec[i] >= 0 ? pos : neg, t);
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		ctx.fillRect(col * cell, row * cell, Math.ceil(cell), Math.ceil(cell));
	}
});

// Strongest dimensions for the table alternative.
const topDims = $derived.by(() => {
	if (!embed?.vector?.length) return [];
	return embed.vector
		.map((value, index) => ({ index, value }))
		.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		.slice(0, 10);
});

function fmtSim(n: number): string {
	return n.toFixed(3);
}
function barWidth(n: number): number {
	return Math.round(Math.max(0, Math.min(1, n)) * 100);
}
</script>

<div class="embed-viz">
	<div class="embed-controls">
		<Switch
			bind:checked={multimodal}
			label="Embed the image itself (multimodal)"
			disabled={!multimodalAvailable || loading}
		/>
		<Button type="button" variant="outline" size="sm" onclick={onrun} disabled={loading}>
			{#if loading}<Spinner size="sm" class="mr-2" />{/if}
			<span class="i-lucide-refresh-cw text-icon-sm mr-1" aria-hidden="true"></span>
			Re-embed
		</Button>
	</div>

	{#if !multimodalAvailable}
		<p class="text-fluid-xs text-muted">
			Multimodal image embedding needs a preview model that isn't configured — showing the text-caption embedding.
		</p>
	{/if}

	{#if error}
		<Alert variant="warning" title="Embedding unavailable" description={error} />
	{:else if loading}
		<div class="embed-loading">
			<Spinner size="md" />
			<span class="text-fluid-sm text-muted">
				Embedding…
			</span>
		</div>
	{:else if embed}
		<div class="embed-head">
			<Badge variant="secondary">
				<span class="i-lucide-box text-icon-sm mr-1" aria-hidden="true"></span>
				{embed.modality === 'image' ? 'image' : 'caption'} · {embed.dimensions}-dim
			</Badge>
			<span class="text-fluid-xs text-muted"><code>{embed.model}</code></span>
			<span class="text-fluid-xs text-muted">
				‖v‖ = {embed.l2Norm.toFixed(3)}
			</span>
		</div>

		{#if embed.sourceText}
			<p class="embed-source text-fluid-xs text-muted">
				Embedded text: <span class="embed-source-text">“{embed.sourceText}”</span>
			</p>
		{/if}

		<!-- ── Cosine similarity to the fixed corpus ── -->
		<section class="embed-block" aria-labelledby="embed-neighbors-h">
			<h4 id="embed-neighbors-h" class="text-fluid-sm font-semibold">
				Closest concepts (cosine similarity)
			</h4>
			<ul class="neighbors">
				{#each embed.neighbors as n, i (n.label)}
					<li class="neighbor">
						<span class="neighbor-label text-fluid-sm">
							{n.label}
							{#if i === 0}
								<Badge variant="secondary">
									closest
								</Badge>
							{/if}
						</span>
						<span class="neighbor-bar" aria-hidden="true">
							<span class="neighbor-fill" style="width:{barWidth(n.similarity)}%"></span>
						</span>
						<span class="neighbor-val text-fluid-xs">{fmtSim(n.similarity)}</span>
					</li>
				{/each}
			</ul>
		</section>

		<!-- ── Per-dimension heatmap (decorative; table below is the SR view) ── -->
		<section class="embed-block" aria-labelledby="embed-heatmap-h">
			<h4 id="embed-heatmap-h" class="text-fluid-sm font-semibold">
				The vector, dimension by dimension
			</h4>
			<canvas
				bind:this={canvasEl}
				class="heatmap"
				role="img"
				aria-label={`Heatmap of a ${embed.dimensions}-dimension embedding; blue cells are positive values, red negative, brightness is magnitude. A table of the strongest dimensions follows.`}
			></canvas>
			<details class="embed-table-toggle">
				<summary class="text-fluid-sm">
					View strongest dimensions as a table
				</summary>
				<table class="dim-table">
					<thead>
						<tr>
							<th scope="col">Dimension</th>
							<th scope="col" class="num">Value</th>
						</tr>
					</thead>
					<tbody>
						{#each topDims as d (d.index)}
							<tr>
								<th scope="row">#{d.index}</th>
								<td class="num">{d.value.toFixed(4)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</details>
			<p class="text-fluid-xs text-muted embed-caveat">
				Illustrative: a real {embed.dimensions}-dimension vector isn't human-readable. The bars above show where it
				lands among a tiny fixed set of concepts.
			</p>
		</section>
	{/if}
</div>

<style>
	.embed-viz {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.embed-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.embed-loading {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
	}

	.embed-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2) var(--spacing-3);
	}

	.embed-head code,
	.embed-source-text {
		font-family: ui-monospace, monospace;
	}

	.embed-source {
		margin: 0;
	}

	.embed-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.neighbors {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.neighbor {
		display: grid;
		grid-template-columns: 10rem 1fr 3rem;
		align-items: center;
		gap: var(--spacing-3);
	}

	.neighbor-label {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.neighbor-bar {
		position: relative;
		height: 0.5rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		overflow: hidden;
	}

	.neighbor-fill {
		position: absolute;
		inset-block: 0;
		left: 0;
		border-radius: var(--radius-full);
		background: var(--color-primary);
	}

	.neighbor-val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}

	.heatmap {
		width: 100%;
		max-width: 32rem;
		display: block;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		image-rendering: pixelated;
	}

	.embed-table-toggle {
		max-width: 32rem;
	}

	.embed-table-toggle summary {
		cursor: pointer;
		color: var(--color-fg);
	}

	.dim-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.dim-table th,
	.dim-table td {
		text-align: left;
		padding: var(--spacing-1) var(--spacing-2);
		border-bottom: 1px solid var(--color-border);
	}

	.dim-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.embed-caveat {
		margin: 0;
		max-width: 38rem;
	}
</style>
