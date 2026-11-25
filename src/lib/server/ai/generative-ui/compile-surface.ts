/**
 * Compile a model's surface into the A2UI v1.0 messages a browser may render — the one door
 * model-composed UI passes through on the server.
 *
 * Two inputs: A2UI **Express** (the compact format the model is prompted to write, ~half the
 * tokens of JSON, compiled by `@a2ui/agent`'s official parser) or A2UI **JSON** (messages a
 * model or another agent produced directly). Both end in the same three checks, in order:
 *
 *   1. bounded before parsing — the source's size, so a parser never sees a flood;
 *   2. the surface policy (`#lib/generative-ui/policy.ts`) — one surface, known catalog,
 *      root present, no cycles, bounded depth/count/strings/data, paths inside the surface,
 *      no executable URLs, no function calls;
 *   3. the catalog validator (`@a2ui/agent`'s `validatePayload`) — every component matches
 *      its JSON Schema in the v10r catalog, so an unknown property is a refusal.
 *
 * Framework-free and transport-free: an AI tool, a REST endpoint or an eval calls it alike.
 * It returns refusals as values; turning one into a tool error or an HTTP status is the
 * caller's job.
 */
import { ExpressParser, validatePayload } from '@a2ui/agent';
import {
	checkGenerativeSurfaceBatch,
	GENERATIVE_SURFACE_LIMITS,
	type GenerativeSurfaceGraph,
	type GenerativeSurfaceMessage,
	type GenerativeSurfaceRefusal,
} from '#lib/generative-ui/index.ts';
import { loadGenerativeUiCatalog } from '#lib/generative-ui/load-catalog.ts';

export type GenerativeSurfaceSource =
	| { format: 'express'; source: string }
	| { format: 'json'; source: string | readonly unknown[] };

export interface GenerativeSurfaceCompileOptions {
	/** The surface the source must address. Express sources without `surface(...)` get it. */
	surfaceId: string;
	/**
	 * The graph earlier batches of this surface built, for a follow-up update. Without it the
	 * source must create the surface.
	 */
	previous?: GenerativeSurfaceGraph;
}

export interface GenerativeSurfaceCompileRefusal {
	code: GenerativeSurfaceRefusal['code'] | 'source_too_large' | 'invalid_express' | 'invalid_json';
	at: string;
	message: string;
}

export type GenerativeSurfaceCompilation =
	| { ok: true; messages: GenerativeSurfaceMessage[]; graph: GenerativeSurfaceGraph }
	| { ok: false; refusals: GenerativeSurfaceCompileRefusal[] };

const refuse = (code: GenerativeSurfaceCompileRefusal['code'], message: string): GenerativeSurfaceCompilation => ({
	ok: false,
	refusals: [{ code, at: '', message: message.slice(0, 500) }],
});

export function compileGenerativeSurface(
	input: GenerativeSurfaceSource,
	options: GenerativeSurfaceCompileOptions,
): GenerativeSurfaceCompilation {
	const size = typeof input.source === 'string' ? input.source.length : JSON.stringify(input.source).length;
	if (size > GENERATIVE_SURFACE_LIMITS.maxBatchBytes) {
		return refuse(
			'source_too_large',
			`source of ${size} characters exceeds ${GENERATIVE_SURFACE_LIMITS.maxBatchBytes}`,
		);
	}
	const catalog = loadGenerativeUiCatalog();

	let messages: unknown;
	if (input.format === 'express') {
		try {
			messages = new ExpressParser([catalog], options.surfaceId, '1.0').compile(input.source, true);
		} catch (error) {
			return refuse('invalid_express', error instanceof Error ? error.message : 'the Express source did not compile');
		}
	} else if (typeof input.source === 'string') {
		try {
			messages = JSON.parse(input.source);
		} catch {
			return refuse('invalid_json', 'the source is not JSON');
		}
	} else {
		// Copied: web_core keeps references into the messages it applies, so a caller's
		// object must never become a renderer's live state.
		messages = structuredClone(input.source);
	}

	const policy = checkGenerativeSurfaceBatch(messages, {
		surfaceId: options.surfaceId,
		previous: options.previous,
		complete: true,
	});
	if (!policy.ok) return { ok: false, refusals: policy.refusals };

	try {
		validatePayload([catalog], messages);
	} catch (error) {
		return refuse(
			'catalog_violation',
			error instanceof Error ? error.message : 'the surface does not match the catalog',
		);
	}
	return { ok: true, messages: messages as GenerativeSurfaceMessage[], graph: policy.graph };
}
