/**
 * The MCP protocol revisions v10r speaks, declared once for both transports.
 *
 * Zero imports on purpose: the stdio server (`mcp/server.ts`) runs from a read-only mount with no
 * node_modules, and the hosted transport (`src/lib/server/mcp/`) reads this same file through the
 * `#mcp/*` subpath import. One list means the two transports cannot disagree about what they
 * negotiate — they once did (the hosted fallback answered 2025-06-18 while stdio answered
 * 2025-11-25).
 */

/**
 * Revisions served per request, with no handshake (the modern era, 2026-07-28 onwards), newest
 * first. Kept apart from the legacy list so a modern revision can never leak into an `initialize`
 * answer, and so `server/discover` advertises exactly these.
 */
export const MODERN_PROTOCOL_VERSIONS = ['2026-07-28'] as const;

/** The first revision of the modern era. Any revision string at or after it names the modern era. */
const FIRST_MODERN_PROTOCOL_VERSION = '2026-07-28';

/**
 * Whether a revision string belongs to the modern era — including revisions this server does not
 * know yet, which is what lets a future client get a -32022 "supported: …" answer instead of a
 * legacy one. Revision ids are ISO dates, so string order is date order.
 */
export function namesModernEra(version: string): boolean {
	return version >= FIRST_MODERN_PROTOCOL_VERSION;
}

export function isModernProtocolVersion(value: unknown): value is string {
	return typeof value === 'string' && (MODERN_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

/** Revisions negotiated by `initialize` (the legacy era), newest first. */
export const LEGACY_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

/** The answer to an `initialize` that asks for a revision this server does not know (spec SHOULD: the latest). */
export const LATEST_LEGACY_PROTOCOL_VERSION = LEGACY_PROTOCOL_VERSIONS[0];

export function isLegacyProtocolVersion(value: unknown): value is string {
	return typeof value === 'string' && (LEGACY_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

/** `initialize` negotiation: echo a supported request, otherwise answer the latest supported revision. */
export function negotiateLegacyProtocolVersion(requested: unknown): string {
	return isLegacyProtocolVersion(requested) ? requested : LATEST_LEGACY_PROTOCOL_VERSION;
}
