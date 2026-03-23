import { createHighlighter, type Highlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let highlighterPromise: Promise<Highlighter> | null = null;

export function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: ['github-light', 'github-dark'],
			langs: ['svelte', 'typescript', 'css', 'html', 'javascript', 'json', 'bash'],
			engine: createJavaScriptRegexEngine(),
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
