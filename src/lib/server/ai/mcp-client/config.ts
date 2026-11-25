/**
 * MCP client policy — the bounds v10r puts on every MCP peer, whatever the peer says about itself.
 *
 * A peer is someone else's server: its tool list, its descriptions and its results are all
 * attacker-controllable input. Each number here caps one way a peer could spend v10r's resources
 * or the model's context (a 10 000-tool list, a megabyte description, a result that never ends).
 */

/** How long connecting (discover/initialize) may take. */
export const PEER_CONNECT_TIMEOUT_MS = 10_000;

/** How long one `tools/list` page may take. */
export const PEER_LIST_TIMEOUT_MS = 10_000;

/** How long one `tools/call` may take, unless the caller passes a shorter one. */
export const PEER_CALL_TIMEOUT_MS = 20_000;

/** Tools kept from one peer; the rest are dropped and the listing is flagged. */
export const MAX_PEER_TOOLS = 64;

/** `tools/list` pages followed before the listing stops (a cursor loop is a peer's to make). */
export const MAX_PEER_LIST_PAGES = 8;

/** Characters of a tool description the model may see; longer ones are cut and flagged. */
export const MAX_PEER_DESCRIPTION_CHARS = 1_024;

/** Bytes of one HTTP response body the guarded fetch reads before failing the exchange. */
export const MAX_PEER_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Characters of one tool result the model may see; longer results are cut and flagged. */
export const MAX_PEER_RESULT_CHARS = 16_000;

/** Peer tool calls one turn may make, across every peer. */
export const PEER_CALLS_PER_TURN = 4;

/** The provider-safe ceiling of a model-facing tool name (`^[a-zA-Z0-9_-]{1,64}$`). */
export const MAX_TOOL_NAME_CHARS = 64;

/** Every projected tool's name starts with this, so it can never shadow a catalogue tool. */
export const PEER_TOOL_PREFIX = 'mcp_';

/**
 * The only namespace a peer's bearer secret reference may name. A reference outside it —
 * `DATABASE_URL`, `BETTER_AUTH_SECRET`, any other deployment secret — is refused by config
 * validation AND by the resolver, so a peer config can never make v10r send its own secrets out.
 */
export const PEER_SECRET_PREFIX = 'MCP_PEER_SECRET_';

/** Bytes of canonical JSON arguments one call sends, unless the peer's disclosure policy lowers it. */
export const DEFAULT_PEER_ARGUMENT_BYTES = 4 * 1024;

/** The ceiling a peer's disclosure policy may raise the argument size to. */
export const MAX_PEER_ARGUMENT_BYTES = 32 * 1024;

/** How long an approved external call stays executable; a later replay is refused as `expired`. */
export const PEER_APPROVAL_TTL_MS = 15 * 60_000;
