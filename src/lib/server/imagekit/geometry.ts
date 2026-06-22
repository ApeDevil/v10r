/**
 * Pure crop geometry — no sharp, no AI, fully unit-testable.
 *
 * The vision model returns only a salient HINT (a focal point + a loose subject
 * box, in Gemini-native conventions). We NEVER trust the model's pixel edges:
 * `snapToAspect` re-derives an exact-ratio rectangle from the true image
 * dimensions, centred on the hint, clamped into bounds. Garbage or absent hints
 * degrade to a deterministic centre crop — they can never throw or escape the image.
 */
import { CROP_RATIO_VALUE, type CropRatio, largestRatioRect } from '$lib/schemas/showcase/image-kit';

export interface PixelRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

function isFiniteNum(n: unknown): n is number {
	return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/**
 * Snap a model focal/box hint to an exact-ratio pixel rect.
 *
 * @param focalPoint  [x, y] in 0..1 (fractions of W/H). The crop centres here.
 * @param subjectBox  [ymin, xmin, ymax, xmax] in 0..1000 (Gemini-native, y-first). [0,0,0,0] = none.
 * @returns the snapped pixel rect + a `fallback` flag (true = no usable hint, centred default).
 */
export function snapToAspect(
	focalPoint: readonly number[] | null | undefined,
	subjectBox: readonly number[] | null | undefined,
	ratio: CropRatio,
	W: number,
	H: number,
): { rect: PixelRect; fallback: boolean } {
	const { width: cropW, height: cropH } = largestRatioRect(CROP_RATIO_VALUE[ratio], W, H);

	// ── Subject box: [ymin, xmin, ymax, xmax], 0..1000, y-first ──
	let boxUsable = false;
	let boxCx = W / 2;
	let boxCy = H / 2;
	if (subjectBox && subjectBox.length === 4 && subjectBox.every(isFiniteNum)) {
		const ymin = clamp(subjectBox[0], 0, 1000);
		const xmin = clamp(subjectBox[1], 0, 1000);
		const ymax = clamp(subjectBox[2], 0, 1000);
		const xmax = clamp(subjectBox[3], 0, 1000);
		if (xmax > xmin && ymax > ymin) {
			boxUsable = true;
			boxCx = ((xmin + xmax) / 2 / 1000) * W;
			boxCy = ((ymin + ymax) / 2 / 1000) * H;
		}
	}

	// ── Focal point: [x, y], 0..1 ──
	const fxRaw = focalPoint?.[0];
	const fyRaw = focalPoint?.[1];
	const fx = isFiniteNum(fxRaw) ? fxRaw : Number.NaN;
	const fy = isFiniteNum(fyRaw) ? fyRaw : Number.NaN;
	const focalUsable = Number.isFinite(fx) && Number.isFinite(fy);
	// The model emits [0.5, 0.5] when it has no clear subject — treat that as "no signal".
	const focalIsCenter = focalUsable && Math.abs(fx - 0.5) < 1e-3 && Math.abs(fy - 0.5) < 1e-3;

	// Fallback only when there is no usable signal at all.
	const fallback = !boxUsable && (!focalUsable || focalIsCenter);

	let cx: number;
	let cy: number;
	if (focalUsable && !focalIsCenter) {
		cx = clamp(fx, 0, 1) * W;
		cy = clamp(fy, 0, 1) * H;
	} else if (boxUsable) {
		cx = boxCx;
		cy = boxCy;
	} else {
		cx = W / 2;
		cy = H / 2;
	}

	const left = Math.round(clamp(cx - cropW / 2, 0, Math.max(0, W - cropW)));
	const top = Math.round(clamp(cy - cropH / 2, 0, Math.max(0, H - cropH)));
	return { rect: { left, top, width: cropW, height: cropH }, fallback };
}
