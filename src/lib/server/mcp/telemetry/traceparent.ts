/**
 * W3C Trace Context extraction.
 *
 * MCP normatively carries trace context in `params._meta.traceparent` (SEP-414, Final). Separately,
 * some clients send the HTTP `traceparent` header — that is the W3C spec's own carrier, but MCP's
 * `_meta`→header forwarding is still an open SEP, so the header is de-facto rather than normative.
 * Read both: `_meta` first (normative), header as fallback (what is actually observed in the wild).
 *
 * ⚠ THIS IS AN INCIDENT-LOOKUP KEY, NOT A FUNNEL KEY. A trace groups one logical operation — in
 * practice one agent turn — so it does NOT connect an `initialize` at connect time to a `tools/call`
 * minutes later. Grouping a funnel by it would measure only the subpopulation modern enough to emit
 * trace context and would render a plausible-looking chart of the wrong population.
 *
 * `baggage` and `tracestate` are deliberately NOT read. `baggage` is designed to carry arbitrary
 * application key/value pairs — `userId=alice` is its canonical example — so recording it would
 * import a third party's identifiers into this database. `tracestate` is an unbounded vendor blob.
 */

/** Length ceiling applied BEFORE any regex, so a hostile client cannot hand us pathological input. */
const MAX_TRACEPARENT_LENGTH = 128;

/**
 * Start-anchored ONLY, deliberately.
 *
 * W3C forward-compatibility permits future versions to append extra `-`-separated fields, so a
 * `$`-anchored pattern would silently drop every future-version traceparent — a slow-rotting bug
 * that would look like "adoption fell off" rather than like a parser problem.
 */
const TRACEPARENT_RE = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}/;

const ALL_ZERO_TRACE_ID = '0'.repeat(32);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract the 32-hex trace-id, or null.
 *
 * Only the trace-id is kept. The parent-id is the caller's own span and changes per request, so it
 * is useless as a grouping key and is simply more third-party data to hold.
 */
export function parseTraceparent(raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > MAX_TRACEPARENT_LENGTH) return null;
	const match = TRACEPARENT_RE.exec(raw);
	if (match === null) return null;
	const traceId = match[1];
	// An all-zero trace-id is invalid per W3C — treat it as absent rather than storing a sentinel.
	return traceId === ALL_ZERO_TRACE_ID ? null : traceId;
}

/**
 * Read trace context from the JSON-RPC body, preferring the MCP-normative `_meta` location.
 *
 * The body is read BEFORE the transport validates the envelope, so this must be defensive: it walks
 * only plain-data property accesses (JSON.parse output has no getters) and cannot throw.
 */
export function traceIdFromMessage(parsed: unknown): string | null {
	if (!isRecord(parsed)) return null;
	const params = parsed.params;
	if (!isRecord(params)) return null;
	const meta = params._meta;
	if (!isRecord(meta)) return null;
	return parseTraceparent(meta.traceparent);
}

/** `_meta` first (normative), then the HTTP header (de-facto). Never assume the two agree. */
export function resolveTraceId(parsed: unknown, headers: Headers): string | null {
	return traceIdFromMessage(parsed) ?? parseTraceparent(headers.get('traceparent'));
}
