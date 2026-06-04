/**
 * markdown-split — a heading-aware, fence-safe text splitter shared by the in-app
 * RAG ingest pipeline (`chunk.ts`) and the standalone docs-ingestion Bun script
 * (`scripts/db/ingest-docs.ts`).
 *
 * It MUST stay dependency-free — no `$lib`, no `$env`, no `import.meta` — because
 * the Bun script imports it by relative path and cannot resolve Vite aliases. All
 * tuning (target/overlap tokens) arrives as parameters, never from config imports.
 *
 * Behaviour vs a plain paragraph splitter:
 *   - ATX headings (`^#{1,6} `) are section boundaries — a chunk never merges body
 *     across a heading once it already holds content, so unrelated sections don't
 *     bleed into one embedding.
 *   - Fenced code blocks (``` or ~~~) are atomic — never split mid-fence.
 *   - When a long section overflows the size budget, each continuation chunk is
 *     re-prefixed with its section heading so the embedded text keeps its context.
 *
 * On input with no headings/fences (uploads, web, plain text) it degrades to the
 * original paragraph-plus-size behaviour, so non-markdown sources are unaffected.
 */

export interface SplitOptions {
	/** Approximate max tokens per chunk. */
	targetTokens: number;
	/** Approximate tokens of trailing context carried into the next chunk (0 = none). */
	overlapTokens: number;
}

/** Rough token estimate: ~4 chars per token for English prose. */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^\s*(```+|~~~+)/;

/**
 * Break text into atomic blocks: each heading line, each blank-line-delimited
 * paragraph, and each fenced code block is one indivisible block.
 */
function splitIntoBlocks(text: string): string[] {
	const lines = text.split('\n');
	const blocks: string[] = [];
	let buf: string[] = [];
	let inFence = false;
	let fenceChar = '';

	const flushBuf = () => {
		if (buf.length) {
			const joined = buf.join('\n').trim();
			if (joined) blocks.push(joined);
			buf = [];
		}
	};

	for (const line of lines) {
		const fence = line.match(FENCE_RE);
		if (fence) {
			const char = fence[1][0]; // ` or ~
			if (!inFence) {
				flushBuf();
				inFence = true;
				fenceChar = char;
				buf.push(line);
			} else if (char === fenceChar) {
				buf.push(line);
				flushBuf(); // closing fence — emit the whole block atomically
				inFence = false;
				fenceChar = '';
			} else {
				buf.push(line);
			}
			continue;
		}
		if (inFence) {
			buf.push(line);
			continue;
		}
		if (HEADING_RE.test(line)) {
			flushBuf();
			blocks.push(line.trim()); // heading is its own block
			continue;
		}
		if (line.trim() === '') {
			flushBuf(); // blank line closes a paragraph
		} else {
			buf.push(line);
		}
	}
	flushBuf();
	return blocks;
}

/**
 * Split markdown (or plain text) into overlapping chunks at heading and paragraph
 * boundaries, packing up to ~`targetTokens` each. Returns at least one chunk.
 */
export function splitMarkdown(text: string, { targetTokens, overlapTokens }: SplitOptions): string[] {
	const blocks = splitIntoBlocks(text);
	const chunks: string[] = [];
	let current = '';
	let currentHasBody = false; // current chunk holds non-heading content
	let currentHeading = ''; // most recent section heading line

	const flush = () => {
		if (current.trim()) chunks.push(current.trim());
	};

	for (const block of blocks) {
		if (HEADING_RE.test(block)) {
			// Start a fresh section once the current chunk already has body content.
			if (current && currentHasBody) {
				flush();
				current = '';
				currentHasBody = false;
			}
			current = current ? `${current}\n\n${block}` : block;
			currentHeading = block.split('\n')[0];
			continue;
		}

		const combined = current ? `${current}\n\n${block}` : block;
		if (estimateTokens(combined) > targetTokens && current && currentHasBody) {
			flush();
			const words = current.split(/\s+/);
			const overlapWords = Math.floor(overlapTokens * 1.3); // ~1.3 words per token
			const overlap = overlapTokens > 0 ? words.slice(-overlapWords).join(' ') : '';
			// Re-attach the section heading so the continuation chunk keeps its context.
			current = [currentHeading, overlap, block].filter(Boolean).join('\n\n');
			currentHasBody = true;
		} else {
			current = combined;
			currentHasBody = true;
		}
	}
	flush();

	return chunks.length > 0 ? chunks : [text.trim()];
}
