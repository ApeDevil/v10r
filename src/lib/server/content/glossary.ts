/**
 * Read and parse `content/glossary.md` — the term-lock and per-locale register
 * decisions cony references when authoring translations.
 *
 * The glossary is *informational* infrastructure: it exists so cony (or Claude
 * Code in this conversation) can reference one source of truth for product names,
 * formality decisions, and recurring terms. It is not consumed by any runtime
 * resolver — drift is caught by `bun run content:check`, not at request time.
 *
 * Format (markdown sections):
 *   ## Do not translate          ← bullet list of literal strings
 *   ## Per-locale voice          ← bullet list "<locale>: <register notes>"
 *   ## Term lock                 ← markdown table | en | de | ru | …
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isLocale, type Locale } from '$lib/i18n/runtime';
import type { Glossary, GlossaryTerm } from './types';

const DEFAULT_PATH = join(process.cwd(), 'content', 'glossary.md');

/** Read and parse the glossary file. Returns an empty glossary if the file is missing. */
export async function loadGlossary(path: string = DEFAULT_PATH): Promise<Glossary> {
	let text: string;
	try {
		text = await readFile(path, 'utf8');
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			return { doNotTranslate: [], registerByLocale: {}, termLock: [] };
		}
		throw err;
	}
	return parseGlossary(text);
}

export function parseGlossary(text: string): Glossary {
	const sections = splitSections(text);
	return {
		doNotTranslate: parseBulletList(sections['Do not translate'] ?? ''),
		registerByLocale: parseRegister(sections['Per-locale voice'] ?? ''),
		termLock: parseTermLockTable(sections['Term lock'] ?? ''),
	};
}

function splitSections(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	const lines = text.split(/\r?\n/);
	let current: string | null = null;
	let buffer: string[] = [];
	for (const line of lines) {
		const heading = /^##\s+(.+?)\s*$/.exec(line);
		if (heading) {
			if (current !== null) out[current] = buffer.join('\n');
			current = heading[1];
			buffer = [];
		} else if (current !== null) {
			buffer.push(line);
		}
	}
	if (current !== null) out[current] = buffer.join('\n');
	return out;
}

function parseBulletList(section: string): string[] {
	return section
		.split(/\r?\n/)
		.map((l) => l.match(/^\s*[-*]\s+(.+?)\s*$/)?.[1])
		.filter((s): s is string => Boolean(s))
		.map(stripParenAside);
}

function stripParenAside(s: string): string {
	return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function parseRegister(section: string): Partial<Record<Exclude<Locale, 'en'>, string>> {
	const out: Partial<Record<Exclude<Locale, 'en'>, string>> = {};
	for (const item of parseBulletList(section)) {
		const m = /^([a-z]{2}(?:-[A-Z]{2})?):\s*(.+)$/.exec(item);
		if (!m) continue;
		const locale = m[1];
		if (!isLocale(locale) || locale === 'en') continue;
		out[locale as Exclude<Locale, 'en'>] = m[2].trim();
	}
	return out;
}

function parseTermLockTable(section: string): GlossaryTerm[] {
	const lines = section.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
	if (lines.length < 2) return [];
	const headerCells = splitTableRow(lines[0]);
	const localeColumns: { idx: number; locale: Exclude<Locale, 'en'> }[] = [];
	let enIdx = -1;
	headerCells.forEach((cell, idx) => {
		const key = cell.toLowerCase();
		if (key === 'en') enIdx = idx;
		else if (isLocale(key) && key !== 'en') localeColumns.push({ idx, locale: key as Exclude<Locale, 'en'> });
	});
	if (enIdx === -1) return [];

	const out: GlossaryTerm[] = [];
	for (let i = 2; i < lines.length; i++) {
		const cells = splitTableRow(lines[i]);
		const en = cells[enIdx];
		if (!en) continue;
		const translations: GlossaryTerm['translations'] = {};
		for (const { idx, locale } of localeColumns) {
			const value = cells[idx];
			if (value && value.trim().length > 0) translations[locale] = value;
		}
		out.push({ en, translations });
	}
	return out;
}

function splitTableRow(line: string): string[] {
	return line
		.split('|')
		.map((c) => c.trim())
		.filter((_, i, arr) => i > 0 && i < arr.length - 1);
}
