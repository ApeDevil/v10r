/**
 * llmwiki runtime constants.
 *
 * Favour overrides via env only when the value has operational meaning
 * (rate limits, per-turn caps). Pure algorithmic numbers stay here.
 */

/** Max raw-chunk pointers surfaced per llmwiki hit. */
export const POINTER_CAP = 5;

/** Max llmwiki hits returned to the prompt per query. */
export const LLMWIKI_SEARCH_LIMIT = 6;

/** Max body tokens for the always-loaded overview page. */
export const OVERVIEW_MAX_TOKENS = 500;

/** Max `get_rawrag_chunks` calls per chat turn — prevents corpus enumeration. */
export const MAX_RAWRAG_TOOL_CALLS_PER_TURN = 3;

/** Max ids accepted by `get_rawrag_chunks` per call. */
export const MAX_RAWRAG_TOOL_IDS = 20;

/** Max ids accepted by `get_llmwiki_pages` per call. */
export const MAX_LLMWIKI_TOOL_IDS = 10;

/**
 * Fraction of cited chunks that must have a hash mismatch before the
 * llmwiki page is flagged `stale` at query time.
 */
export const STALENESS_RATIO_THRESHOLD = 0.2;

/** Reciprocal Rank Fusion constant for llmwiki hybrid search. */
export const LLMWIKI_RRF_K = 60;

/** Overfetch multiplier so RRF has material to fuse. */
export const LLMWIKI_OVERFETCH_MULTIPLIER = 3;
