/**
 * Merged vision call — metadata + a crop hint in ONE generateText pass (image
 * tokens paid once). Modeled on imagemeta/extract.ts: resolves a vision provider
 * (never Groq), constrains output with Output.object(jsonSchema), re-validates with
 * the canonical Valibot schema (drift → model_refused), charges tokens, and never
 * throws — every failure collapses into a typed envelope so the page keeps working.
 *
 * The model returns only a salient HINT; the server snaps exact aspect geometry
 * deterministically (see geometry.ts) — model pixel edges are never trusted.
 */
import { generateText, jsonSchema, Output } from 'ai';
import sharp from 'sharp';
import * as v from 'valibot';
import {
	CONFIDENCE_TIERS,
	CROP_RATIOS,
	type CropFrame,
	IMAGE_CATEGORIES,
	type ImageKitVision,
	imageKitVisionSchema,
	type VisionFailureReason,
	type VisionResponse,
	visionIsEmpty,
} from '$lib/schemas/showcase/image-kit';
import { getVisionProvider } from '$lib/server/ai';
import { chargeTokens, checkUserBudget } from '$lib/server/ai/budget';
import { estimateCost } from '$lib/server/ai/pricing';
import { AI_MAX_TOKENS } from '$lib/server/config';
import { snapToAspect } from './geometry';

/** Gemini "thinking" tokens, read defensively from provider metadata (null otherwise). */
function readThoughtsTokens(meta: unknown): number | null {
	const google = (meta as { google?: { usageMetadata?: { thoughtsTokenCount?: unknown } } } | undefined)?.google;
	const value = google?.usageMetadata?.thoughtsTokenCount;
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Sum known token counts; null only when every term is null. */
function sumKnown(...values: (number | null)[]): number | null {
	const known = values.filter((n): n is number => n != null);
	return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

const SYSTEM = `You extract metadata AND suggest a crop region from a single image. A human reviews and approves everything.

METADATA — fill using ONLY what is visibly present:
- title: short and specific (max ~8 words). null if you truly cannot tell.
- caption: 1-2 plain sentences describing what is shown. null if unsure.
- altText: concise accessibility alt text (max ~125 chars). null only if the image is unreadable.
- keywords: 3-8 short lowercase tags. Empty array if none apply.
- category: exactly one of photo, illustration, screenshot, diagram, document, other. null if unclear.
- confidence: for EACH metadata field above, report high, medium, or low.

CROP — identify the single most important region to keep when cropping:
- crop.subjectBox: the main subject's bounding box as [ymin, xmin, ymax, xmax], integers 0-1000. Use [0,0,0,0] if there is no clear subject.
- crop.focalPoint: the single point the crop should keep centered, as [x, y] floats 0-1. Use [0.5, 0.5] if there is no clear subject.
- crop.note: one short phrase naming what the crop centers on (e.g. "the person's face"). null if none.

Rules: describe only what you can actually see. Never invent names, brands, places, or text you cannot read. Approximate crop coordinates are fine — they will be snapped to exact aspect ratios server-side. If the image is blank, corrupt, or unreadable, return null for content fields, an empty keywords array, low confidence everywhere, subjectBox [0,0,0,0], and focalPoint [0.5,0.5].`;

const USER_PROMPT = 'Analyse this image: fill the metadata and suggest the main crop region.';

// AI SDK v6 Output.object wants an SDK Schema (jsonSchema), not a Valibot schema directly.
// Mirrors imageKitVisionSchema; the model output is re-validated against that canonical
// Valibot schema below, so any drift between the two surfaces as model_refused.
const visionJsonSchema = jsonSchema<ImageKitVision>({
	type: 'object',
	additionalProperties: false,
	required: ['title', 'caption', 'altText', 'keywords', 'category', 'confidence', 'crop'],
	properties: {
		title: { type: ['string', 'null'], description: 'Short, specific title (max ~8 words). null if unknown.' },
		caption: { type: ['string', 'null'], description: '1-2 sentence description. null if unsure.' },
		altText: { type: ['string', 'null'], description: 'Accessibility alt text (max ~125 chars). null if unreadable.' },
		keywords: { type: 'array', items: { type: 'string' }, description: '3-8 lowercase tags; empty array if none.' },
		category: { type: ['string', 'null'], enum: [...IMAGE_CATEGORIES, null] },
		confidence: {
			type: 'object',
			additionalProperties: false,
			required: ['title', 'caption', 'altText', 'keywords', 'category'],
			properties: {
				title: { type: 'string', enum: [...CONFIDENCE_TIERS] },
				caption: { type: 'string', enum: [...CONFIDENCE_TIERS] },
				altText: { type: 'string', enum: [...CONFIDENCE_TIERS] },
				keywords: { type: 'string', enum: [...CONFIDENCE_TIERS] },
				category: { type: 'string', enum: [...CONFIDENCE_TIERS] },
			},
		},
		crop: {
			type: 'object',
			additionalProperties: false,
			required: ['subjectBox', 'focalPoint', 'note'],
			properties: {
				subjectBox: {
					type: 'array',
					items: { type: 'number' },
					minItems: 4,
					maxItems: 4,
					description: 'Main subject box [ymin,xmin,ymax,xmax], integers 0-1000. [0,0,0,0] if none.',
				},
				focalPoint: {
					type: 'array',
					items: { type: 'number' },
					minItems: 2,
					maxItems: 2,
					description: 'Crop centre point [x,y], floats 0-1. [0.5,0.5] if no clear subject.',
				},
				note: { type: ['string', 'null'], description: 'Short phrase naming the crop subject; null if none.' },
			},
		},
	},
});

export async function runVision(userId: string, bytes: Uint8Array): Promise<VisionResponse> {
	const budget = await checkUserBudget(userId);
	if (!budget.allowed) {
		return { ok: false, reason: 'budget', message: budget.reason };
	}

	const provider = getVisionProvider(userId);
	const model = provider?.getInstance() ?? null;
	if (!provider || !model) {
		return { ok: false, reason: 'no_provider', message: 'No vision-capable AI provider is configured.' };
	}

	let width = 0;
	let height = 0;
	try {
		const meta = await sharp(bytes).metadata();
		width = meta.width ?? 0;
		height = meta.height ?? 0;
	} catch {
		return { ok: false, reason: 'error', message: 'Could not read the image.' };
	}
	if (!width || !height) {
		return { ok: false, reason: 'error', message: 'Could not read the image dimensions.' };
	}

	const start = performance.now();
	try {
		const result = await generateText({
			model,
			system: SYSTEM,
			maxOutputTokens: AI_MAX_TOKENS,
			maxRetries: 1,
			abortSignal: AbortSignal.timeout(30_000),
			output: Output.object({ schema: visionJsonSchema }),
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: USER_PROMPT },
						{ type: 'image', image: bytes, mediaType: 'image/webp' },
					],
				},
			],
		});

		const parsed = v.safeParse(imageKitVisionSchema, result.output);
		if (!parsed.success) {
			return { ok: false, reason: 'model_refused', message: 'The AI returned malformed output. Try another image.' };
		}
		const a = parsed.output;

		const inputTokens = result.usage?.inputTokens ?? null;
		const outputTokens = result.usage?.outputTokens ?? null;
		const reasoningTokens = readThoughtsTokens(result.providerMetadata);
		await chargeTokens(userId, (inputTokens ?? 0) + (outputTokens ?? 0));

		if (visionIsEmpty(a)) {
			return { ok: false, reason: 'model_refused', message: 'The AI could not read this image. Try another.' };
		}

		const crops: CropFrame[] = CROP_RATIOS.map((ratio) => {
			const { rect, fallback } = snapToAspect(a.crop.focalPoint, a.crop.subjectBox, ratio, width, height);
			return { ratio, rect, fallback };
		});

		return {
			ok: true,
			fields: {
				title: a.title,
				caption: a.caption,
				altText: a.altText,
				keywords: a.keywords,
				category: a.category,
			},
			confidence: a.confidence,
			image: { width, height },
			crops,
			cropNote: a.crop.note,
			usage: {
				providerId: provider.id,
				modelId: provider.model,
				inputTokens,
				outputTokens,
				reasoningTokens,
				totalTokens: sumKnown(inputTokens, outputTokens),
				durationMs: Math.round(performance.now() - start),
			},
			cost: estimateCost(provider.model, { inputTokens, outputTokens, reasoningTokens }),
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Vision analysis failed.';
		const reason: VisionFailureReason = /timeout|abort/i.test(message) ? 'timeout' : 'error';
		return { ok: false, reason, message };
	}
}
