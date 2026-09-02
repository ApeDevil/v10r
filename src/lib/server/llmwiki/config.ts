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

/** Max `get_source_chunks` calls per chat turn — prevents corpus enumeration. */
export const MAX_SOURCE_CHUNK_TOOL_CALLS_PER_TURN = 3;

/** Max ids accepted by `get_source_chunks` per call. */
export const MAX_SOURCE_CHUNK_TOOL_IDS = 20;

/** Max ids accepted by `get_llmwiki_pages` per call. */
export const MAX_LLMWIKI_TOOL_IDS = 10;

// RRF_K and OVERFETCH_MULTIPLIER are not redeclared here: the wiki layer fuses with the
// same constants as the chunk layer it sits on, so both read them from `retrieval`.
