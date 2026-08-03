/**
 * Write-time scrubbing for the one free-text column this design keeps.
 *
 * A length CHECK bounds how MUCH text lands in the table; nothing bounds what KIND. A static
 * analysis of ~10,600 public MCP servers found logging to be the dominant privacy-leak vector, with
 * the majority of leaks being credentials — an agent pasting a key into a search query is an
 * entirely ordinary accident. So the column gets a scrubber, not just a cap.
 *
 * This is intentionally a small, boring allowlist of well-known secret SHAPES. It is a floor, not a
 * guarantee: it cannot recognise a bespoke token format, and it is not a substitute for the far
 * stronger control, which is that `query_text` is only ever written on the no-match path.
 */

/**
 * Well-known credential prefixes. Kept in one place because the same patterns already exist,
 * privately, in at least two other modules — a third copy would be the point at which they start
 * drifting apart.
 */
const SECRET_PATTERNS: RegExp[] = [
	/(?:sk-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|AKIA|ASIA|xox[baprs]-|glpat-)\S+/gi,
	/\bBearer\s+\S+/gi,
	// JWTs: three base64url segments. Anchored on the `eyJ` header prefix to avoid eating prose.
	/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g,
	// Connection strings of any scheme carrying userinfo.
	/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@\S+/gi,
	// Long unbroken base64-ish runs — the shape of a raw key with no recognisable prefix.
	/\b[A-Za-z0-9+/=]{40,}\b/g,
];

/** Email addresses are personal data and have no business in a capability-gap report. */
const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[^\s@]{2,}\b/g;

const REDACTED = '[redacted]';

/**
 * Remove secret-shaped and email-shaped substrings.
 *
 * Order matters: connection strings and Bearer tokens are matched before the generic long-base64
 * rule, so the more specific (and more legible) replacement wins.
 */
export function scrubSecrets(text: string): string {
	let out = text;
	for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED);
	return out.replace(EMAIL_RE, REDACTED);
}

/**
 * Normalise a caller-supplied query for storage: collapse whitespace, scrub, then truncate.
 *
 * Truncation is last so the cap applies to what is actually stored. The database enforces the same
 * ceiling independently — this function is the polite path, the CHECK is the floor under a bug here.
 */
export function normalizeQueryText(raw: unknown, maxLength: number): string | null {
	if (typeof raw !== 'string') return null;
	const collapsed = raw.replace(/\s+/g, ' ').trim();
	if (collapsed.length === 0) return null;
	const scrubbed = scrubSecrets(collapsed);
	return scrubbed.length > maxLength ? scrubbed.slice(0, maxLength) : scrubbed;
}

/**
 * Normalise a TOOL ANSWER for storage (the private lane's `response_text`): scrub, then truncate —
 * deliberately WITHOUT the whitespace collapse `normalizeQueryText` applies.
 *
 * A query is one line of prose; an answer is markdown with fenced code blocks, and collapsing
 * `\s+` to a single space destroys exactly the structure the column exists to preserve.
 * Scrub-before-truncate is kept for the same reason as there: truncating first can leave the
 * leading half of a key in the column.
 *
 * Known over-redaction: the long-base64-run rule can eat a legitimate base64-ish literal inside a
 * registry code example. That is cosmetic and strictly the safe direction — do not debug a
 * `[redacted]` inside an answer preview as a bug.
 */
export function normalizeResponseText(raw: unknown, maxLength: number): string | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	const scrubbed = scrubSecrets(trimmed);
	return scrubbed.length > maxLength ? scrubbed.slice(0, maxLength) : scrubbed;
}
