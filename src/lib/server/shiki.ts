import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Uses shiki's default Oniguruma (WASM) engine, NOT the JS regex engine.
 *
 * The JS engine is the documented choice for smaller bundles and faster startup,
 * but neither benefit applies here and the tokenising cost is large. Measured in
 * the container, 200 renders of a TypeScript block, two runs:
 *
 *   engine   init      200 renders
 *   JS       16-20ms   6828 / 6689 ms   (~34 ms per render)
 *   WASM     31-32ms   1262 / 1300 ms   (~6.3 ms per render)
 *
 * So WASM costs ~15 ms once per process and saves ~27 ms on every highlight —
 * it pays for itself on the first code fence. The bundle argument is moot too:
 * `@shikijs/engine-oniguruma` (636 KB, wasm inlined) is traced into the function
 * package either way, so we were shipping the WASM and then not using it.
 *
 * This is on a hot path: `/docs/**` is the largest traffic block, and crawlers
 * drive ~520 full docs renders/day against ~16 by humans.
 */
export function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: ['github-light', 'github-dark'],
			langs: ['svelte', 'typescript', 'css', 'html', 'javascript', 'json', 'bash', 'sql'],
		});
	}
	return highlighterPromise;
}

export async function highlight(code: string, lang: string): Promise<string> {
	const hl = await getHighlighter();
	return hl.codeToHtml(code, {
		lang,
		themes: { light: 'github-light', dark: 'github-dark' },
	});
}
