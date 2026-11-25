/**
 * The content screen — what the arguments of an external operation carry, decided before
 * anything is shown for approval. Disclosure is authorized separately from mutation, and this is
 * the rule that makes it so:
 *
 *  1. **Secrets are never disclosable.** Arguments carrying a deployment secret (any environment
 *     value under a secret-shaped name, plus the adapter's own peer credential) or a
 *     credential-shaped string (a private key block, a provider or forge token, a JWT, a URL with
 *     a password) are REFUSED — no approval can send them, so none is asked for.
 *  2. **Wrapped untrusted content is never relayed.** Arguments containing the
 *     `<untrusted-content` boundary are refused: they would forward another party's text,
 *     boundary and all, to a third party.
 *  3. **Quoted read content needs its own authorization.** When a string argument quotes
 *     (`QUOTE_WINDOW_CHARS` consecutive characters, whitespace-normalized) text a tool result put
 *     in front of the model this turn — a desk document, a retrieved chunk, another peer's
 *     answer — the disclosure is `quotes_read_content` and names the tools quoted. The approve
 *     door then requires an explicit `authorizeQuotedContent` on top of the approval: the
 *     operator's field allowlist says which fields may leave, never that the user's documents may
 *     ride in them. What the user typed themselves is not read content.
 *
 * Everything else is `arguments_only` — text the model composed, which the user sees in full on
 * the card (the complete outgoing arguments, `outgoing-arguments.ts`) and authorizes by approving.
 *
 * Defense-in-depth, not data loss prevention: the screen knows known secret values, credential
 * shapes and literal quotes. It does not know what is confidential, and a paraphrase, an encoding
 * or a fragment shorter than the quote window passes. The human reading the complete arguments,
 * the operator's field allowlist and the approval gate are what protect the data.
 */
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import type { ExternalContentClass, ExternalReadContent } from './contract';

/** Consecutive characters an argument must share with read content to count as quoting it. */
export const QUOTE_WINDOW_CHARS = 24;

/** Characters of read content compared per source (the tail is what the model saw last). */
const MAX_READ_CHARS = 64 * 1024;

/** Characters of one string value the preview keeps. */
const PREVIEW_VALUE_CHARS = 80;

/** Characters of the whole preview. */
const PREVIEW_CHARS = 600;

/** Shortest environment value treated as a secret (shorter ones are flags, ports, names). */
const MIN_SECRET_CHARS = 12;

const SECRET_NAME = /SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|_KEY$|DATABASE_URL|CREDENTIAL/;

/** Credential shapes refused wherever they appear. */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
	/-----BEGIN [A-Z ]*PRIVATE KEY-----/,
	/\bsk-[A-Za-z0-9_-]{20,}/,
	/\bgh[pousr]_[A-Za-z0-9]{30,}/,
	/\bxox[abprs]-[A-Za-z0-9-]{10,}/,
	/\bAKIA[0-9A-Z]{16}\b/,
	/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
	/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i,
];

export type ContentScreenRefusal = 'secret_in_arguments' | 'untrusted_markup_in_arguments';

export type ContentScreen =
	| { ok: true; contentClass: ExternalContentClass; quotedFrom: string[] }
	| { ok: false; reason: ContentScreenRefusal };

/** The deployment's secret values: environment variables under a secret-shaped name. */
export function deploymentSecretValues(env: Record<string, string | undefined> = process.env): string[] {
	return Object.entries(env)
		.filter(([name, value]) => SECRET_NAME.test(name) && typeof value === 'string' && value.length >= MIN_SECRET_CHARS)
		.map(([, value]) => value as string);
}

/** Every string inside `value` — keys included, since a key is sent too. */
function stringLeaves(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (Array.isArray(value)) for (const item of value) stringLeaves(item, out);
	else if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			out.push(key);
			stringLeaves(item, out);
		}
	}
	return out;
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

/** True when some `QUOTE_WINDOW_CHARS`-long window of `leaf` occurs in `haystack`. */
function quotes(leaf: string, haystack: string): boolean {
	if (leaf.length < QUOTE_WINDOW_CHARS) return false;
	const step = Math.max(1, Math.floor(QUOTE_WINDOW_CHARS / 3));
	for (let at = 0; at + QUOTE_WINDOW_CHARS <= leaf.length; at += step) {
		if (haystack.includes(leaf.slice(at, at + QUOTE_WINDOW_CHARS))) return true;
	}
	return haystack.includes(leaf.slice(-QUOTE_WINDOW_CHARS));
}

export interface ScreenOptions {
	readContent?: readonly ExternalReadContent[];
	/** Exact secret values to refuse; default the deployment's (`deploymentSecretValues`). */
	secrets?: readonly string[];
}

/** The screen's verdict on one operation's arguments. */
export function screenExternalArguments(args: unknown, options: ScreenOptions = {}): ContentScreen {
	const leaves = stringLeaves(args);
	const secrets = (options.secrets ?? deploymentSecretValues()).filter((s) => s.length >= MIN_SECRET_CHARS);
	for (const leaf of leaves) {
		if (secrets.some((secret) => leaf.includes(secret))) return { ok: false, reason: 'secret_in_arguments' };
		if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(leaf))) return { ok: false, reason: 'secret_in_arguments' };
		if (/<\s*untrusted-content\b/i.test(leaf)) return { ok: false, reason: 'untrusted_markup_in_arguments' };
	}
	const quotedFrom = new Set<string>();
	const normalizedLeaves = leaves.map(normalize).filter((leaf) => leaf.length >= QUOTE_WINDOW_CHARS);
	for (const read of options.readContent ?? []) {
		const haystack = normalize(read.text.slice(-MAX_READ_CHARS));
		if (normalizedLeaves.some((leaf) => quotes(leaf, haystack))) quotedFrom.add(read.source);
	}
	return quotedFrom.size > 0
		? { ok: true, contentClass: 'quotes_read_content', quotedFrom: [...quotedFrom].sort() }
		: { ok: true, contentClass: 'arguments_only', quotedFrom: [] };
}

function shortened(value: unknown): unknown {
	if (typeof value === 'string') {
		return value.length > PREVIEW_VALUE_CHARS
			? `${value.slice(0, PREVIEW_VALUE_CHARS)}… (+${value.length - PREVIEW_VALUE_CHARS} chars)`
			: value;
	}
	if (Array.isArray(value)) return value.map(shortened);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shortened(item)]));
	}
	return value;
}

/**
 * The card's preview of the arguments: canonical JSON with long strings cut and the whole
 * bounded. The fields and byte count beside it are exact; only the values are shortened.
 */
export function previewExternalArguments(args: unknown): string {
	const text = canonicalJson(shortened(args));
	return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}
