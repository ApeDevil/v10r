/**
 * Pure derivation of the hosted `get_file_excerpt` allowlist from the curated registry. Kept
 * dependency-free (no `$env`, no Bun, no fs) so it can be imported BOTH by the runtime reader
 * (`excerpts.ts`) and by the build-time snapshot generator (`scripts/mcp/build-public-excerpts.ts`)
 * — one source of truth, so the snapshot and the runtime gate can never disagree.
 */
import { DEEP_PATTERNS, type RegRef } from '$lib/server/patterns';

/** Files this size or larger are never snapshotted/served. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Secret / VCS / dependency paths are excluded even if a ref somehow points at one. */
export const SECRET_DENY = [
	/(^|\/)\.env(\..*)?$/i,
	/\.pem$/i,
	/\.key$/i,
	/secret/i,
	/credential/i,
	/(^|\/)\.git(\/|$)/i,
	/node_modules/,
];

/** A ref is an excerptable file when it is kind:'file' or an unspecified path with an extension. */
export function isFileRef(ref: RegRef): boolean {
	if (ref.kind === 'file') return true;
	if (ref.kind !== undefined) return false; // dir / route / anchor are not excerptable files
	const last = ref.path.split('/').pop() ?? '';
	return !ref.path.endsWith('/') && last.includes('.');
}

/**
 * Sorted, deduplicated list of registry-referenced, non-secret file paths.
 *
 * DEEP tier only. Measured before the two-tier split: including the 125 light
 * index rows would pull ~93 docs files (1.28 MB) + ~57 code files (0.38 MB)
 * into the committed snapshot — 73 files / 784 KB → ~220 files / ~2.5 MB inlined
 * into the Vercel function bundle, with every docs edit dirtying the snapshot.
 * Light-record docs stay agent-reachable as raw markdown via the public `.md`
 * layer (`/docs/<path>.md`) at zero bundle cost.
 */
export function deriveExcerptAllowlist(): string[] {
	const allow = new Set<string>();
	for (const pattern of DEEP_PATTERNS) {
		for (const ref of [...pattern.docs, ...pattern.code, ...pattern.tests, ...pattern.showcases]) {
			if (!isFileRef(ref)) continue;
			if (SECRET_DENY.some((rx) => rx.test(ref.path))) continue;
			allow.add(ref.path);
		}
	}
	return [...allow].sort();
}

/** The exact set of repo-relative paths the hosted endpoint will excerpt. */
export const EXCERPT_ALLOWLIST: ReadonlySet<string> = new Set(deriveExcerptAllowlist());

export function isAllowlisted(path: string): boolean {
	return EXCERPT_ALLOWLIST.has(path);
}
