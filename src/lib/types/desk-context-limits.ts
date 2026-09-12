/**
 * The bounds of what a deskbot turn may carry as panel context — ONE declaration for the
 * client serializer (`components/desk/desk-context.pure.ts`), the request schema
 * (`server/ai/validation.ts`) and the prompt builder (`server/ai/context/system-prompt.ts`).
 * With three copies the client once accepted six pinned panels the route refused, and the
 * prompt cut an entry the client had labelled `full`.
 */

/** Panel entries per request. Beyond it, entries are omitted and the omission is shown. */
export const CONTEXT_MAX_ENTRIES = 5;

/** Characters per entry. A longer entry is truncated by the client and labelled so. */
export const CONTEXT_ENTRY_MAX_CHARS = 8_000;

/** Approximate tokens for all entries of one request combined. */
export const CONTEXT_TOKEN_BUDGET = 8_000;

/** Open panels reported to `desk_get_open_panels` per request (identity only, no content). */
export const DESK_LAYOUT_MAX_PANELS = 20;
