/**
 * Context-probe report — the wire contract of `POST /api/ai/context-probe`,
 * the showcase "context orchestration x-ray" behind `/showcases/ai/*#probe`.
 *
 * CLIENT-SAFE BY CONSTRUCTION: ids, names, counts, scores, and short previews
 * only. No prompt bodies, no thresholds, no provider internals — the type has
 * no field that could hold them. The server maps lane failures to the generic
 * `retrieval_failed` code; raw error messages never cross this boundary.
 */

export type ProbeSurface = 'chatbot' | 'deskbot';

/** A retrieval lane the probe can exercise. */
export type ProbeLane = 'llmwiki' | 'docs' | 'desk';

/** One routing decision the surface made for THIS query. */
export interface ProbeGate {
	/**
	 * - `ground_docs`  — chatbot triviality gate: fired=false means NO embedding and
	 *                    NO retrieval ran at all (greetings/acks short-circuit).
	 * - `page_deixis`  — chatbot site-awareness gate: the message points at the current
	 *                    page, so the embed query was seeded with the page title/breadcrumb.
	 * - `require_plan` — deskbot governor: the `<planning>` block was injected because a
	 *                    mutating scope is granted AND the phrasing signals destruction.
	 */
	id: 'ground_docs' | 'page_deixis' | 'require_plan';
	fired: boolean;
	/** Named boolean inputs behind the verdict (e.g. `destructiveIntent`). */
	inputs?: Record<string, boolean>;
}

/** Corpus size visible to this user on one lane — the "available" side. */
export interface ProbeLaneInventory {
	lane: ProbeLane;
	documents: number;
	chunks?: number;
}

/** One retrieval candidate — ranked, with the chosen/passed-over verdict. */
export interface ProbeCandidate {
	title: string;
	/** Short plain-text preview (truncated server-side). */
	preview: string;
	/** Relevance score where the lane exposes one (llmwiki hits are RRF-fused, no score). */
	score?: number;
	source: 'vector' | 'bm25' | 'graph' | 'llmwiki';
	tier: string;
	/** True when this candidate crossed the production cutoff into the prompt. */
	chosen: boolean;
}

/** What one lane did for this query: ran + ranked, or why it didn't run. */
export interface ProbeLaneResult {
	lane: ProbeLane;
	ran: boolean;
	/**
	 * - `gated_off`    — the triviality gate closed (no embed spent).
	 * - `scope_off`    — deskbot: `desk:ask` not granted, so the search tool isn't mounted.
	 * - `empty_corpus` — nothing ingested on this lane for this user (no embed spent).
	 */
	skippedReason?: 'gated_off' | 'scope_off' | 'empty_corpus';
	/** Production top-k — candidates at rank < cutoff are the chosen set. */
	cutoff: number;
	candidates: ProbeCandidate[];
	/** Generic failure code when the lane errored (`retrieval_failed`). */
	error?: string;
}

/** One assembled prompt block — identity + size, never the text. */
export interface ProbePromptBlock {
	id: string;
	/** chars/4 estimate. */
	tokensEst: number;
	/** True when the block's content depends on THIS query/request (vs stable context). */
	dynamic: boolean;
}

export interface ProbeReport {
	surface: ProbeSurface;
	gates: ProbeGate[];
	/** What exists (per lane) before any choosing happens. */
	inventory: ProbeLaneInventory[];
	/** Tool names mounted for this surface/scope set — static per turn, never per query. */
	tools: string[];
	/** What each lane did for this query. */
	lanes: ProbeLaneResult[];
	/** Block outline of the prompt this query would produce (ids + sizes only). */
	prompt: { blocks: ProbePromptBlock[]; totalTokensEst: number };
	/**
	 * The embed query actually used (chatbot only) — page-seeded when the deixis
	 * gate fired. Server-authored prefix + the caller's own message.
	 */
	docsQuery?: string;
}
