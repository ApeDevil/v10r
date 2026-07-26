/**
 * Image analysis — decode, downscale, then extract a palette.
 *
 * Browser-only (needs createImageBitmap + OffscreenCanvas), but deliberately free
 * of any worker plumbing: the SAME function runs on the main thread and inside
 * image-analysis.worker.ts, so the showcase demo compares identical work rather
 * than two different implementations. The pure, node-testable half is palette.ts.
 */
import { averageLuminance, dominantColors, type Swatch } from './palette';

export interface AnalysisRequest {
	bytes: ArrayBuffer;
	/** Longest edge of the downscaled buffer. Larger = slower = a better demo. */
	maxEdge?: number;
	/** How many swatches to return. */
	swatches?: number;
	/** Extra full passes over the pixels, to make the cost visible on small images. */
	passes?: number;
}

export interface AnalysisResult {
	width: number;
	height: number;
	sampledWidth: number;
	sampledHeight: number;
	swatches: Swatch[];
	luminance: number;
	/** Wall-clock ms for decode + downscale + palette, measured where it ran. */
	durationMs: number;
}

const DEFAULT_MAX_EDGE = 720;
const DEFAULT_SWATCHES = 6;
const DEFAULT_PASSES = 3;

/**
 * `OffscreenCanvas` is the only way to rasterise without a DOM node, which is what
 * makes this callable from a worker at all. It is available in every browser this
 * project targets; the caller is responsible for the (never-hit in practice)
 * fallback messaging.
 */
export function canAnalyseImages(): boolean {
	return typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function';
}

export async function analyseImage(request: AnalysisRequest): Promise<AnalysisResult> {
	const maxEdge = request.maxEdge ?? DEFAULT_MAX_EDGE;
	const swatchCount = request.swatches ?? DEFAULT_SWATCHES;
	const passes = Math.max(1, request.passes ?? DEFAULT_PASSES);

	const started = performance.now();

	const bitmap = await createImageBitmap(new Blob([request.bytes]));
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const sampledWidth = Math.max(1, Math.round(bitmap.width * scale));
	const sampledHeight = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = new OffscreenCanvas(sampledWidth, sampledHeight);
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		bitmap.close();
		throw new Error('Could not acquire a 2D context');
	}

	ctx.drawImage(bitmap, 0, 0, sampledWidth, sampledHeight);
	const { data } = ctx.getImageData(0, 0, sampledWidth, sampledHeight);

	// Repeat the pixel walk so the cost is legible even on a modest photo. This is
	// the honest way to make the demo visible: more of the SAME work, not fake work.
	let swatches: Swatch[] = [];
	let luminance = 0;
	for (let i = 0; i < passes; i++) {
		swatches = dominantColors(data, swatchCount);
		luminance = averageLuminance(data);
	}

	const result: AnalysisResult = {
		width: bitmap.width,
		height: bitmap.height,
		sampledWidth,
		sampledHeight,
		swatches,
		luminance,
		durationMs: Math.round(performance.now() - started),
	};

	bitmap.close();
	return result;
}
