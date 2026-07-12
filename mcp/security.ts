/**
 * Path containment and bounded excerpt reading for get_file_excerpt.
 * The container mount is already read-only and network-less; these checks add
 * traversal/symlink containment and a secret denylist on top. Client-supplied
 * roots are advisory in MCP — the server owns this boundary.
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

export const DEFAULT_ROOT = process.env.V10R_ROOT ?? '/v10r';
export const MAX_LINES = 250;
export const DEFAULT_LINES = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 36 * 1024;

const DENY_SEGMENTS = ['.git', 'node_modules', '.svelte-kit'];
const DENY_NAME_PATTERNS = [
	/^\.env(\..*)?$/i,
	/\.pem$/i,
	/\.key$/i,
	/secret/i,
	/credential/i,
	/^settings\.local\.json$/i,
];

export type SafePath = { ok: true; abs: string } | { ok: false; reason: string };

export function resolveSafe(userPath: string, root: string = DEFAULT_ROOT): SafePath {
	if (typeof userPath !== 'string' || userPath.trim().length === 0) {
		return { ok: false, reason: 'path must be a non-empty repo-relative string like "src/lib/server/ai/guard.ts".' };
	}
	if (isAbsolute(userPath)) {
		return { ok: false, reason: `absolute paths are rejected — pass a repo-relative path (got '${userPath}').` };
	}
	const segments = userPath.split(/[\\/]+/);
	for (const segment of segments) {
		if (DENY_SEGMENTS.includes(segment) || DENY_NAME_PATTERNS.some((pattern) => pattern.test(segment))) {
			return {
				ok: false,
				reason: `path segment '${segment}' is denied (secrets, VCS, and dependency dirs are off-limits).`,
			};
		}
	}
	let realRoot: string;
	let abs: string;
	try {
		realRoot = realpathSync(root);
		abs = realpathSync(resolve(root, userPath));
	} catch {
		return {
			ok: false,
			reason: `'${userPath}' does not exist in the repo. Check the path against get_pattern output.`,
		};
	}
	if (abs !== realRoot && !abs.startsWith(realRoot + sep)) {
		return { ok: false, reason: `'${userPath}' escapes the repo root — traversal is rejected.` };
	}
	return { ok: true, abs };
}

export interface Excerpt {
	ok: boolean;
	text: string;
	totalLines?: number;
	shownFrom?: number;
	shownTo?: number;
}

export function readExcerpt(
	userPath: string,
	startLine: number = 1,
	lineCount: number = DEFAULT_LINES,
	root: string = DEFAULT_ROOT,
): Excerpt {
	const safe = resolveSafe(userPath, root);
	if (!safe.ok) {
		return { ok: false, text: safe.reason };
	}
	const stats = statSync(safe.abs);
	if (stats.isDirectory()) {
		return { ok: false, text: `'${userPath}' is a directory — pass a file path (see the pattern's code[] entries).` };
	}
	if (stats.size > MAX_FILE_BYTES) {
		return { ok: false, text: `'${userPath}' is ${stats.size} bytes — too large to excerpt (limit 2MB).` };
	}
	const raw = readFileSync(safe.abs);
	if (raw.subarray(0, 8192).includes(0)) {
		return { ok: false, text: `'${userPath}' looks binary — excerpts are text-only.` };
	}
	const lines = raw.toString('utf8').split('\n');
	const total = lines.length;
	const from = Math.max(1, Math.floor(startLine));
	if (from > total) {
		return { ok: false, text: `start_line ${from} is beyond EOF — '${userPath}' has ${total} lines.` };
	}
	const count = Math.min(Math.max(1, Math.floor(lineCount)), MAX_LINES);
	const to = Math.min(from + count - 1, total);
	const width = String(to).length;
	const body = lines
		.slice(from - 1, to)
		.map((line, index) => `${String(from + index).padStart(width)}\t${line}`)
		.join('\n');
	let text = `# ${userPath} (lines ${from}-${to} of ${total})\n${body}`;
	if (text.length > MAX_OUTPUT_BYTES) {
		text = `${text.slice(0, MAX_OUTPUT_BYTES)}\n… [truncated at ${MAX_OUTPUT_BYTES} bytes — request a narrower range]`;
	}
	return { ok: true, text, totalLines: total, shownFrom: from, shownTo: to };
}
