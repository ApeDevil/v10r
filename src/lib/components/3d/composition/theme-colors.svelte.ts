import { resolveCssColor } from '../css-color';

const FALLBACK = '#8a8f98';

/**
 * Design tokens resolved to colours WebGL can use, kept current across theme changes: `.dark`
 * (mode) and `data-palette` (scheme) both land on `<html>`, so one observer covers both.
 * Call during component initialisation.
 */
export function themeColors(tokens: readonly string[]): Record<string, string> {
	const colors = $state<Record<string, string>>({});
	const read = () => {
		for (const token of tokens) colors[token] = resolveCssColor(token, FALLBACK);
	};
	$effect(() => {
		read();
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, { attributeFilter: ['class', 'data-palette'] });
		return () => observer.disconnect();
	});
	return colors;
}

export const colorOf = (colors: Record<string, string>, token: string): string => colors[token] ?? FALLBACK;
