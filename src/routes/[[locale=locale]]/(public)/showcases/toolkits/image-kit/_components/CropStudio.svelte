<script lang="ts">
/**
 * Accessible frame-over-image cropper. A custom overlay (no external lib) because
 * it maps 1:1 to the server's pixel-rect model and gives full keyboard control:
 *  - ratio ToggleGroup (1:1 / 16:9 / 9:16)
 *  - drag the frame to move; Arrow keys nudge (Shift = faster)
 *  - drag a corner handle to resize on the image, or use the size Slider
 *    (both locked to the ratio — one scalar, no two-axis trap; the opposite
 *    corner stays anchored while dragging)
 *  - Reset restores the AI suggestion
 *  - "Compare" fetches the deterministic sharp `attention` crop side-by-side
 * The frame can never leave the image; geometry mirrors the server's snapToAspect.
 */
import { Alert } from '$lib/components/composites';
import { Badge, Button, Slider, Spinner, ToggleGroup } from '$lib/components/primitives';
import {
	CROP_RATIO_VALUE,
	CROP_RATIOS,
	type CropDerivativeResponse,
	type CropFrame,
	type CropRatio,
	largestRatioRect,
} from '$lib/schemas/showcase/image-kit';

interface CropRect {
	left: number;
	top: number;
	width: number;
	height: number;
}
interface View {
	cx: number;
	cy: number;
	scale: number;
	fallback: boolean;
}

interface Props {
	imageId: string;
	previewUrl: string;
	image: { width: number; height: number };
	crops: CropFrame[];
	cropNote: string | null;
	/** Exposes the live per-ratio pixel rects so the page can download/approve them. */
	currentRects?: Partial<Record<CropRatio, CropRect>>;
}

let { imageId, previewUrl, image, crops, cropNote, currentRects = $bindable({}) }: Props = $props();

const MIN_SCALE = 0.3;
const W = $derived(image.width);
const H = $derived(image.height);

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/** Build the editable per-ratio view from the AI suggestions. */
function initialView(): Record<CropRatio, View> {
	const out = {} as Record<CropRatio, View>;
	for (const ratio of CROP_RATIOS) {
		const max = largestRatioRect(CROP_RATIO_VALUE[ratio], W, H);
		const frame = crops.find((c) => c.ratio === ratio);
		const r = frame?.rect ?? { left: 0, top: 0, width: max.width, height: max.height };
		out[ratio] = {
			cx: r.left + r.width / 2,
			cy: r.top + r.height / 2,
			scale: clamp(r.width / max.width, MIN_SCALE, 1),
			fallback: frame?.fallback ?? true,
		};
	}
	return out;
}

let view = $state<Record<CropRatio, View>>(initialView());
let activeRatioStr = $state<string>('1:1');
const activeRatio = $derived(activeRatioStr as CropRatio);

// Re-seed when a fresh analysis arrives (new crops array identity).
$effect(() => {
	void crops;
	view = initialView();
	activeRatioStr = '1:1';
});

function rectFor(ratio: CropRatio): CropRect {
	const v = view[ratio];
	const max = largestRatioRect(CROP_RATIO_VALUE[ratio], W, H);
	const width = Math.max(16, Math.round(max.width * v.scale));
	const height = Math.max(16, Math.round(max.height * v.scale));
	const left = Math.round(clamp(v.cx - width / 2, 0, Math.max(0, W - width)));
	const top = Math.round(clamp(v.cy - height / 2, 0, Math.max(0, H - height)));
	return { left, top, width, height };
}

const rect = $derived(rectFor(activeRatio));

// Keep the bindable mirror in sync for the page (download / approve summary).
$effect(() => {
	const out: Partial<Record<CropRatio, CropRect>> = {};
	for (const ratio of CROP_RATIOS) out[ratio] = rectFor(ratio);
	currentRects = out;
});

const ratioItems = CROP_RATIOS.map((r) => ({ value: r, label: r }));

// ── Size slider ↔ active-ratio scale (loop-safe two-way sync) ─────────
let sizeValue = $state<number[]>([100]);
let suppressSizeWrite = false;

// active ratio → slider
$effect(() => {
	const pct = Math.round(view[activeRatio].scale * 100);
	if (sizeValue[0] !== pct) {
		suppressSizeWrite = true;
		sizeValue = [pct];
	}
});

// slider → active-ratio scale
$effect(() => {
	const pct = sizeValue[0];
	if (suppressSizeWrite) {
		suppressSizeWrite = false;
		return;
	}
	const scale = clamp(pct / 100, MIN_SCALE, 1);
	if (Math.abs(view[activeRatio].scale - scale) > 1e-6) {
		view[activeRatio].scale = scale;
		view[activeRatio].fallback = false;
		announce();
	}
});

function resetActive() {
	view[activeRatio] = { ...initialView()[activeRatio] };
	announce();
}

// ── Drag-to-move ─────────────────────────────────────────────────────
let stageEl = $state<HTMLDivElement | null>(null);
let dragging = false;
let startX = 0;
let startY = 0;
let startCx = 0;
let startCy = 0;

function pxPerDisplay(): number {
	const shown = stageEl?.querySelector('img')?.clientWidth ?? W;
	return shown > 0 ? W / shown : 1;
}

function onPointerDown(e: PointerEvent) {
	dragging = true;
	startX = e.clientX;
	startY = e.clientY;
	startCx = view[activeRatio].cx;
	startCy = view[activeRatio].cy;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
	if (!dragging) return;
	const f = pxPerDisplay();
	view[activeRatio].cx = clamp(startCx + (e.clientX - startX) * f, 0, W);
	view[activeRatio].cy = clamp(startCy + (e.clientY - startY) * f, 0, H);
	view[activeRatio].fallback = false;
}
function onPointerUp(e: PointerEvent) {
	if (!dragging) return;
	dragging = false;
	(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	announce();
}

// ── Corner-handle resize (ratio-locked, opposite corner anchored) ─────
type Corner = 'nw' | 'ne' | 'sw' | 'se';
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;
let resizing = false;
let signX = 1; // corner extends +x (east) from the anchor?
let signY = 1; // corner extends +y (south) from the anchor?
let anchorX = 0; // the opposite corner, fixed for the duration of the drag (image px)
let anchorY = 0;

/** Map a pointer event to image-pixel coordinates via the displayed <img> rect. */
function clientToImagePx(e: PointerEvent): { x: number; y: number } {
	const imgEl = stageEl?.querySelector('img');
	if (!imgEl) return { x: view[activeRatio].cx, y: view[activeRatio].cy };
	const r = imgEl.getBoundingClientRect();
	const fx = r.width > 0 ? W / r.width : 1;
	const fy = r.height > 0 ? H / r.height : 1;
	return { x: clamp((e.clientX - r.left) * fx, 0, W), y: clamp((e.clientY - r.top) * fy, 0, H) };
}

function onHandleDown(corner: Corner, e: PointerEvent) {
	e.stopPropagation(); // don't let the frame start a move-drag
	e.preventDefault();
	resizing = true;
	signX = corner === 'ne' || corner === 'se' ? 1 : -1;
	signY = corner === 'se' || corner === 'sw' ? 1 : -1;
	const r = rectFor(activeRatio);
	anchorX = signX > 0 ? r.left : r.left + r.width;
	anchorY = signY > 0 ? r.top : r.top + r.height;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onHandleMove(e: PointerEvent) {
	if (!resizing) return;
	const p = clientToImagePx(e);
	const max = largestRatioRect(CROP_RATIO_VALUE[activeRatio], W, H);
	// Box follows the cursor on the constraining axis (ratio stays locked).
	let scale = Math.max(Math.abs(p.x - anchorX) / max.width, Math.abs(p.y - anchorY) / max.height);
	// Cap so the anchored box can't run past the image edge (keeps the anchor truly fixed).
	const availX = signX > 0 ? W - anchorX : anchorX;
	const availY = signY > 0 ? H - anchorY : anchorY;
	scale = clamp(Math.min(scale, availX / max.width, availY / max.height, 1), MIN_SCALE, 1);
	const w = max.width * scale;
	const h = max.height * scale;
	view[activeRatio] = {
		cx: anchorX + (signX * w) / 2,
		cy: anchorY + (signY * h) / 2,
		scale,
		fallback: false,
	};
}

function onHandleUp(e: PointerEvent) {
	if (!resizing) return;
	resizing = false;
	(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	announce();
}

// ── Keyboard nudge ───────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
	const base = Math.max(1, Math.round(W * 0.01));
	const step = e.shiftKey ? base * 5 : base;
	let handled = true;
	switch (e.key) {
		case 'ArrowLeft':
			view[activeRatio].cx = clamp(view[activeRatio].cx - step, 0, W);
			break;
		case 'ArrowRight':
			view[activeRatio].cx = clamp(view[activeRatio].cx + step, 0, W);
			break;
		case 'ArrowUp':
			view[activeRatio].cy = clamp(view[activeRatio].cy - step, 0, H);
			break;
		case 'ArrowDown':
			view[activeRatio].cy = clamp(view[activeRatio].cy + step, 0, H);
			break;
		default:
			handled = false;
	}
	if (handled) {
		e.preventDefault();
		view[activeRatio].fallback = false;
		announce();
	}
}

// ── Throttled SR announcement ────────────────────────────────────────
let liveStatus = $state('');
let announceTimer: ReturnType<typeof setTimeout> | null = null;
function announce() {
	if (announceTimer) clearTimeout(announceTimer);
	announceTimer = setTimeout(() => {
		const r = rectFor(activeRatio);
		// TODO(i18n)
		liveStatus = `Crop ${activeRatio}: ${r.width} by ${r.height} pixels at ${r.left}, ${r.top}.`;
	}, 350);
}

// ── Deterministic comparison (sharp attention) ───────────────────────
let comparing = $state(false);
let compareError = $state('');
let comparison = $state<Partial<Record<CropRatio, { aiCrop: string; attentionCrop: string }>>>({});

async function compare() {
	comparing = true;
	compareError = '';
	try {
		const res = await fetch(`${location.pathname.replace(/\/$/, '')}/crop`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ imageId, ratio: activeRatio, rect: rectFor(activeRatio) }),
		});
		const body = (await res.json()) as CropDerivativeResponse;
		if (body.ok) {
			comparison[activeRatio] = { aiCrop: body.aiCrop, attentionCrop: body.attentionCrop };
		} else {
			compareError = body.message;
		}
	} catch {
		// TODO(i18n)
		compareError = 'Could not generate the comparison crops.';
	} finally {
		comparing = false;
	}
}

const activeComparison = $derived(comparison[activeRatio]);
const isFallback = $derived(view[activeRatio].fallback);
</script>

<div class="crop-studio">
	<div class="crop-toolbar">
		<ToggleGroup type="single" bind:value={activeRatioStr} items={ratioItems} size="sm" />
		<Button type="button" variant="ghost" size="sm" onclick={resetActive}>
			<span class="i-lucide-rotate-ccw text-icon-sm mr-1" aria-hidden="true"></span>
			<!-- TODO(i18n) -->
			Reset to suggestion
		</Button>
	</div>

	{#if isFallback}
		<!-- TODO(i18n) -->
		<Alert
			variant="warning"
			title="Fallback frame"
			description="The AI didn't find a clear subject for this ratio, so this is a centered default — drag or resize it to taste."
		/>
	{:else if cropNote}
		<p class="crop-note text-fluid-xs text-muted">
			<span class="i-lucide-sparkles text-icon-sm" aria-hidden="true"></span>
			<!-- TODO(i18n) -->
			AI suggestion keeps <strong>{cropNote}</strong>
		</p>
	{/if}

	<div class="crop-stage" bind:this={stageEl}>
		<img src={previewUrl} alt="" class="crop-image" draggable="false" />
		<button
			type="button"
			class="crop-frame"
			style="left:{(rect.left / W) * 100}%; top:{(rect.top / H) * 100}%; width:{(rect.width / W) * 100}%; height:{(rect.height / H) * 100}%;"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onkeydown={onKeydown}
			aria-label={`Crop frame, ${activeRatioStr}. Arrow keys move it; the size slider resizes it.`}
		>
			<span class="crop-frame-grid" aria-hidden="true"></span>
			{#each CORNERS as corner (corner)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<span
					class="crop-handle"
					data-corner={corner}
					aria-hidden="true"
					onpointerdown={(e) => onHandleDown(corner, e)}
					onpointermove={onHandleMove}
					onpointerup={onHandleUp}
				></span>
			{/each}
		</button>
	</div>

	<div class="crop-size">
		<span class="crop-size-label text-fluid-sm">
			<!-- TODO(i18n) -->
			Size <span class="text-muted">({sizeValue[0]}%)</span>
		</span>
		<Slider bind:value={sizeValue} min={30} max={100} step={1} />
	</div>

	<div class="crop-compare">
		<Button type="button" variant="outline" size="sm" onclick={compare} disabled={comparing}>
			{#if comparing}<Spinner size="sm" class="mr-2" />{/if}
			<span class="i-lucide-columns-2 text-icon-sm mr-1" aria-hidden="true"></span>
			<!-- TODO(i18n) -->
			Compare with deterministic crop
		</Button>

		{#if compareError}
			<Alert variant="warning" description={compareError} />
		{/if}

		{#if activeComparison}
			<div class="compare-grid">
				<figure class="compare-cell">
					<img src={activeComparison.aiCrop} alt={`AI-guided ${activeRatioStr} crop`} class="compare-img" />
					<figcaption>
						<Badge variant="secondary">
							<span class="i-lucide-sparkles text-icon-sm mr-1" aria-hidden="true"></span>
							<!-- TODO(i18n) -->
							AI-guided
						</Badge>
					</figcaption>
				</figure>
				<figure class="compare-cell">
					<img src={activeComparison.attentionCrop} alt={`Saliency-based ${activeRatioStr} crop`} class="compare-img" />
					<figcaption>
						<Badge variant="secondary">
							<span class="i-lucide-cpu text-icon-sm mr-1" aria-hidden="true"></span>
							<!-- TODO(i18n) -->
							sharp attention
						</Badge>
					</figcaption>
				</figure>
			</div>
		{/if}
	</div>

	<div aria-live="polite" class="sr-only">{liveStatus}</div>
</div>

<style>
	.crop-studio {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.crop-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.crop-note {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: 0;
	}

	.crop-stage {
		position: relative;
		display: inline-block;
		max-width: 100%;
		width: fit-content;
		overflow: hidden;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		line-height: 0;
		touch-action: none;
	}

	.crop-image {
		display: block;
		max-width: 100%;
		max-height: 420px;
		height: auto;
		width: auto;
		user-select: none;
	}

	.crop-frame {
		position: absolute;
		margin: 0;
		padding: 0;
		background: transparent;
		border: 2px solid var(--color-primary);
		box-shadow: 0 0 0 100vmax color-mix(in srgb, var(--color-bg) 60%, transparent);
		cursor: move;
		touch-action: none;
	}

	.crop-frame:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.crop-frame-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, color-mix(in srgb, var(--color-bg) 70%, transparent) 1px, transparent 1px),
			linear-gradient(to bottom, color-mix(in srgb, var(--color-bg) 70%, transparent) 1px, transparent 1px);
		background-size: 33.33% 33.33%;
		background-position: center;
		pointer-events: none;
	}

	.crop-handle {
		position: absolute;
		width: 14px;
		height: 14px;
		background: var(--color-primary);
		border: 2px solid var(--color-bg);
		border-radius: var(--radius-sm);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--color-fg) 35%, transparent);
		touch-action: none;
		z-index: 1;
	}
	.crop-handle[data-corner='nw'] {
		left: 0;
		top: 0;
		transform: translate(-50%, -50%);
		cursor: nwse-resize;
	}
	.crop-handle[data-corner='ne'] {
		right: 0;
		top: 0;
		transform: translate(50%, -50%);
		cursor: nesw-resize;
	}
	.crop-handle[data-corner='sw'] {
		left: 0;
		bottom: 0;
		transform: translate(-50%, 50%);
		cursor: nesw-resize;
	}
	.crop-handle[data-corner='se'] {
		right: 0;
		bottom: 0;
		transform: translate(50%, 50%);
		cursor: nwse-resize;
	}

	.crop-size {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		max-width: 24rem;
	}

	.crop-size-label {
		font-weight: 500;
	}

	.crop-compare {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.compare-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--spacing-3);
		max-width: 32rem;
	}

	.compare-cell {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		align-items: center;
	}

	.compare-img {
		width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
