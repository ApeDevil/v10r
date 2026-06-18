/**
 * Vision extraction — the AI fill. Resolves a vision-capable provider (never Groq),
 * sends the stored (already-stripped) image to generateText with a Valibot-constrained
 * Output.object, and returns a typed proposal + telemetry. Never throws to the caller:
 * every failure mode collapses into a typed { ok: false, reason } envelope so the manual
 * form keeps working.
 */

import { generateText, jsonSchema, Output } from 'ai';
import * as v from 'valibot';
import {
	analysisIsEmpty,
	CONFIDENCE_TIERS,
	IMAGE_CATEGORIES,
	type ImageAnalysis,
	imageAnalysisSchema,
} from '$lib/schemas/showcase/image-metadata';
import { getVisionProvider } from '$lib/server/ai';
import { chargeTokens, checkUserBudget } from '$lib/server/ai/budget';
import { AI_MAX_TOKENS } from '$lib/server/config';
import { getImageBytes } from '$lib/server/store/showcase/image';
import type { ExtractFailureReason, ExtractResult } from './types';

const SYSTEM = `You extract metadata from a single image to pre-fill a form that a human will review and approve.

Fill these fields using ONLY what is visibly present in the image:
- title: short and specific (max ~8 words). null if you truly cannot tell.
- caption: 1-2 plain sentences describing what is shown. null if unsure.
- altText: concise accessibility alt text (max ~125 chars) for screen-reader users. null only if the image is unreadable.
- keywords: 3-8 short lowercase tags. Empty array if none apply.
- category: exactly one of photo, illustration, screenshot, diagram, document, other. null if unclear.
- confidence: for EACH field above, report your confidence as high, medium, or low.

Rules: describe only what you can actually see. Never invent names, brands, places, or text you cannot read. If the image is blank, corrupt, or unreadable, return null for every content field, an empty keywords array, and low confidence everywhere.`;

const USER_PROMPT = 'Analyse this image and fill out the metadata form.';

// AI SDK v6 Output.object wants an SDK Schema (jsonSchema), not a Valibot schema directly.
// This mirrors imageAnalysisSchema; the model output is still re-validated against the
// canonical Valibot schema below, so any drift between the two surfaces as model_refused.
const analysisJsonSchema = jsonSchema<ImageAnalysis>({
	type: 'object',
	additionalProperties: false,
	required: ['title', 'caption', 'altText', 'keywords', 'category', 'confidence'],
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
	},
});

export async function extractImageMetadata(userId: string, storageKey: string): Promise<ExtractResult> {
	const budget = await checkUserBudget(userId);
	if (!budget.allowed) {
		return { ok: false, reason: 'budget', message: budget.reason };
	}

	const provider = getVisionProvider(userId);
	const model = provider?.getInstance() ?? null;
	if (!provider || !model) {
		return { ok: false, reason: 'no_provider', message: 'No vision-capable AI provider is configured.' };
	}

	let bytes: Uint8Array;
	try {
		bytes = await getImageBytes(storageKey);
	} catch (err) {
		return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Could not read the image.' };
	}

	const start = performance.now();
	try {
		const result = await generateText({
			model,
			system: SYSTEM,
			maxOutputTokens: AI_MAX_TOKENS,
			maxRetries: 1,
			abortSignal: AbortSignal.timeout(30_000),
			output: Output.object({ schema: analysisJsonSchema }),
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

		// Re-validate the model output against the canonical schema (single source of truth).
		const parsed = v.safeParse(imageAnalysisSchema, result.output);
		if (!parsed.success) {
			return {
				ok: false,
				reason: 'model_refused',
				message: 'The AI returned malformed metadata. Fill the form manually.',
			};
		}
		const analysis = parsed.output;
		const inputTokens = result.usage?.inputTokens ?? null;
		const outputTokens = result.usage?.outputTokens ?? null;
		await chargeTokens(userId, (inputTokens ?? 0) + (outputTokens ?? 0));

		// A structurally-valid all-null object means the model could not read the image.
		if (analysisIsEmpty(analysis)) {
			return {
				ok: false,
				reason: 'model_refused',
				message: 'The AI could not read this image. Fill the form manually.',
			};
		}

		return {
			ok: true,
			analysis,
			providerId: provider.id,
			modelId: provider.model,
			inputTokens,
			outputTokens,
			durationMs: Math.round(performance.now() - start),
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Vision analysis failed.';
		const reason: ExtractFailureReason = /timeout|abort/i.test(message) ? 'timeout' : 'error';
		return { ok: false, reason, message };
	}
}
