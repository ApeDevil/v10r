/**
 * Excerpt rendering for `get_file_excerpt`: the ONE place a file's text becomes a bounded,
 * line-numbered answer. Each transport keeps its own READER — the stdio server reads the
 * read-only mount through `mcp/security.ts` (containment, secret denylist), the hosted one reads
 * the build-time snapshot through its registry-derived allowlist — and hands the content here,
 * so the two cannot number, bound, truncate or navigate a file differently.
 *
 * Navigation, so an agent reads the part it needs instead of paging 100 lines blind:
 * - `section` names a markdown heading (text or slug) or a code declaration (function, class,
 *   const, interface, type, enum) and returns exactly that block, its leading doc comment
 *   included;
 * - a `#fragment` on the path — the form pattern cards print their doc refs in — is a section;
 * - a window that stops before EOF ends with the sections that lie below it, with line numbers.
 * Framework-free and filesystem-free, like `schema.ts`.
 */

export const MAX_LINES = 250;
export const DEFAULT_LINES = 100;
const MAX_OUTPUT_BYTES = 36 * 1024;
/** Sections listed under a window, or in a section-not-found answer. */
const MAX_OUTLINE_BELOW = 12;
const MAX_OUTLINE_LISTED = 40;

export type RenderedExcerpt =
	| { ok: true; text: string; shownFrom: number; shownTo: number }
	| { ok: false; text: string; reason: 'beyond_eof' | 'no_section' };

export interface ExcerptRequest {
	startLine?: number;
	lineCount?: number;
	section?: string;
}

/** A path as cards print it — `docs/x.md#some-heading` — split into the file and its section. */
export function splitFragment(path: string): { file: string; fragment: string | undefined } {
	const hash = path.indexOf('#');
	return hash === -1
		? { file: path, fragment: undefined }
		: { file: path.slice(0, hash), fragment: path.slice(hash + 1) };
}

interface Section {
	name: string;
	/** 1-based, inclusive. */
	start: number;
	end: number;
}

/** GitHub-style heading slug (what rehype-slug emits for the docs site, and what cards cite). */
function slug(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
		.replace(/ /g, '-');
}

const isMarkdown = (path: string) => /\.(md|mdx|markdown)$/i.test(path);

function markdownSections(lines: string[]): Section[] {
	const headings: Array<{ name: string; level: number; line: number }> = [];
	let fenced = false;
	lines.forEach((line, index) => {
		if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
		const match = fenced ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (match) headings.push({ name: match[2], level: match[1].length, line: index + 1 });
	});
	return headings.map((heading, index) => {
		const next = headings.slice(index + 1).find((later) => later.level <= heading.level);
		return { name: heading.name, start: heading.line, end: next ? next.line - 1 : lines.length };
	});
}

const DECLARATION =
	/^(?:export\s+(?:default\s+)?)?(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const TOP_LEVEL_COMMENT = /^(\/\*\*|\/\/)/;

/**
 * Top-level declarations, each from its leading doc comment to the line before the next
 * top-level declaration or comment. Column-0 heuristics, not a parser: exact for this
 * repository's formatter-normalised code, and degrading to "a few lines too many", never to
 * a wrong file.
 */
function codeSections(lines: string[]): Section[] {
	const starts: Array<{ name: string; line: number }> = [];
	lines.forEach((line, index) => {
		const match = DECLARATION.exec(line);
		if (match) starts.push({ name: match[1], line: index + 1 });
	});
	return starts.map((declaration, index) => {
		let start = declaration.line;
		while (start > 1 && /^(\/\*\*|\s*\*|\/\/)/.test(lines[start - 2])) start -= 1;
		const limit = starts[index + 1]?.line ?? lines.length + 1;
		let end = declaration.line;
		for (let line = declaration.line + 1; line < limit; line += 1) {
			if (TOP_LEVEL_COMMENT.test(lines[line - 1])) break;
			end = line;
		}
		while (end > declaration.line && lines[end - 1].trim().length === 0) end -= 1;
		return { name: declaration.name, start, end };
	});
}

function sectionsOf(path: string, lines: string[]): Section[] {
	return isMarkdown(path) ? markdownSections(lines) : codeSections(lines);
}

function findSection(sections: Section[], wanted: string): Section | undefined {
	const target = wanted.trim().replace(/\(\)$/, '');
	const lower = target.toLowerCase();
	return (
		sections.find((section) => section.name === target) ??
		sections.find((section) => section.name.toLowerCase() === lower) ??
		sections.find((section) => slug(section.name) === slug(target))
	);
}

const outline = (sections: Section[]) => sections.map((section) => `${section.name} (L${section.start})`).join(', ');

function numbered(path: string, lines: string[], from: number, to: number, label: string): string {
	const width = String(to).length;
	const body = lines
		.slice(from - 1, to)
		.map((line, index) => `${String(from + index).padStart(width)}\t${line}`)
		.join('\n');
	return `# ${path}${label} (lines ${from}-${to} of ${lines.length})\n${body}`;
}

function bounded(text: string): string {
	return text.length > MAX_OUTPUT_BYTES
		? `${text.slice(0, MAX_OUTPUT_BYTES)}\n… [truncated at ${MAX_OUTPUT_BYTES} bytes — request a narrower range]`
		: text;
}

export function renderExcerpt(path: string, content: string, request: ExcerptRequest = {}): RenderedExcerpt {
	const lines = content.split('\n');
	const total = lines.length;
	const count = Math.min(Math.max(1, Math.floor(request.lineCount ?? MAX_LINES)), MAX_LINES);
	if (request.section !== undefined) {
		const sections = sectionsOf(path, lines);
		const section = findSection(sections, request.section);
		if (!section) {
			const listed = sections.slice(0, MAX_OUTLINE_LISTED);
			const more = sections.length > listed.length ? `, … (${sections.length} total)` : '';
			return {
				ok: false,
				reason: 'no_section',
				text:
					sections.length > 0
						? `'${path}' has no section "${request.section}". Its ${isMarkdown(path) ? 'headings' : 'top-level declarations'}: ${outline(listed)}${more}.`
						: `'${path}' has no ${isMarkdown(path) ? 'headings' : 'top-level declarations'} to address — read it by line range instead.`,
			};
		}
		const to = Math.min(section.end, section.start + count - 1);
		const rest = to < section.end ? `\n… section continues to line ${section.end} — request start_line ${to + 1}.` : '';
		return {
			ok: true,
			text: bounded(`${numbered(path, lines, section.start, to, ` § ${section.name}`)}${rest}`),
			shownFrom: section.start,
			shownTo: to,
		};
	}
	const from = Math.max(1, Math.floor(request.startLine ?? 1));
	if (from > total) {
		return {
			ok: false,
			reason: 'beyond_eof',
			text: `start_line ${from} is beyond EOF — '${path}' has ${total} lines.`,
		};
	}
	const windowLines = Math.min(Math.max(1, Math.floor(request.lineCount ?? DEFAULT_LINES)), MAX_LINES);
	const to = Math.min(from + windowLines - 1, total);
	let below = '';
	if (to < total) {
		const later = sectionsOf(path, lines).filter((section) => section.start > to);
		const listed = later.slice(0, MAX_OUTLINE_BELOW);
		const more = later.length > listed.length ? `, … (${later.length - listed.length} more)` : '';
		below =
			listed.length > 0
				? `\n… ${total - to} more lines. Sections below — pass one as section: ${outline(listed)}${more}.`
				: `\n… ${total - to} more lines — request start_line ${to + 1}.`;
	}
	return { ok: true, text: bounded(`${numbered(path, lines, from, to, '')}${below}`), shownFrom: from, shownTo: to };
}
