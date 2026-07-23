/**
 * Build (or verify) the committed excerpt snapshot the hosted public MCP serves in production.
 *
 * The hosted `get_file_excerpt` cannot read the repo source tree on Vercel (it isn't bundled),
 * so this captures every registry-referenced, non-secret, text file into
 * `mcp/public-excerpts.snapshot.json`. That JSON is statically imported by the server and thus
 * inlined into the Vercel function bundle.
 *
 *   bun run mcp:excerpts:build     # regenerate the snapshot (commit the result)
 *   bun run mcp:excerpts:check     # fail if the committed snapshot is stale (wired into the gate)
 *
 * Determinism: file paths are sorted and content is captured verbatim, so regeneration is
 * byte-stable and `--check` reliably detects a moved/renamed/edited reference.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveExcerptAllowlist, MAX_FILE_BYTES } from '../../src/lib/server/mcp/patterns/allowlist.ts';
import { REGISTRY } from '../../src/lib/server/mcp/patterns/data.ts';

const ROOT = resolve(import.meta.dir, '../..');
const SNAPSHOT_PATH = resolve(ROOT, 'mcp/public-excerpts.snapshot.json');

/**
 * Content-level secret guard (defence in depth beyond the filename denylist). Since the snapshot
 * publishes verbatim file content, refuse to bundle a file that carries a private-key block. Kept
 * conservative (essentially zero false positives on curated source) so the gate stays trustworthy.
 */
const SECRET_CONTENT_PATTERNS: Array<[string, RegExp]> = [['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/]];

function build(): string {
	const paths = deriveExcerptAllowlist();
	const files: Record<string, string> = {};
	const problems: string[] = [];
	for (const path of paths) {
		const abs = resolve(ROOT, path);
		try {
			const stats = statSync(abs);
			if (!stats.isFile()) {
				problems.push(`${path}: exists but is not a file`);
				continue;
			}
			if (stats.size > MAX_FILE_BYTES) {
				problems.push(`${path}: ${stats.size} bytes exceeds the ${MAX_FILE_BYTES}-byte limit`);
				continue;
			}
			const raw = readFileSync(abs);
			if (raw.subarray(0, 8192).includes(0)) {
				problems.push(`${path}: looks binary`);
				continue;
			}
			const content = raw.toString('utf8');
			const secret = SECRET_CONTENT_PATTERNS.find(([, pattern]) => pattern.test(content));
			if (secret) {
				problems.push(`${path}: content matches a secret pattern (${secret[0]}) — refusing to publish`);
				continue;
			}
			files[path] = content;
		} catch {
			problems.push(`${path}: could not be read (moved or deleted?)`);
		}
	}
	if (problems.length > 0) {
		console.error(`FAIL excerpt snapshot has ${problems.length} problem(s):`);
		for (const problem of problems) console.error(`  - ${problem}`);
		process.exit(1);
	}
	return `${JSON.stringify({ registryVersion: REGISTRY.version, files }, null, 2)}\n`;
}

const generated = build();
const fileCount = Object.keys((JSON.parse(generated) as { files: Record<string, string> }).files).length;

if (process.argv.includes('--check')) {
	let existing = '';
	try {
		existing = readFileSync(SNAPSHOT_PATH, 'utf8');
	} catch {
		existing = '';
	}
	if (existing !== generated) {
		console.error('FAIL mcp/public-excerpts.snapshot.json is stale or missing. Regenerate: bun run mcp:excerpts:build');
		process.exit(1);
	}
	console.error(`excerpt snapshot OK: ${fileCount} file(s) in sync with the registry`);
} else {
	writeFileSync(SNAPSHOT_PATH, generated);
	console.error(`wrote mcp/public-excerpts.snapshot.json: ${fileCount} file(s)`);
}
