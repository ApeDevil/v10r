const NAME_LINE = /^name:\s*([a-z][a-z0-9-]*)\s*$/m;

export function parseAgentId(sourcePath: string, raw: string): string {
	if (!raw.startsWith('---\n')) {
		throw new Error(`[agents/parse] ${sourcePath}: missing YAML frontmatter`);
	}
	const end = raw.indexOf('\n---', 4);
	if (end === -1) {
		throw new Error(`[agents/parse] ${sourcePath}: unterminated YAML frontmatter`);
	}
	const fm = raw.slice(4, end);
	const m = fm.match(NAME_LINE);
	if (!m) {
		throw new Error(`[agents/parse] ${sourcePath}: no lowercase 'name:' field in frontmatter`);
	}
	return m[1];
}
