/**
 * CLDR plural-completeness contract test.
 *
 * Walks every messages/<locale>.json, finds ICU plural blocks, and asserts that
 * each block contains the categories CLDR requires for its locale. Catches the
 * common Russian failure mode where a plural is written with `one`/`other` only
 * (English plural rules) and silently produces wrong output for 5+ items.
 *
 * Required cardinal categories per CLDR v47:
 *   - en, de: { one, other }
 *   - ru:     { one, few, many, other }
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MESSAGES_DIR = join(process.cwd(), 'messages');

const REQUIRED: Record<string, readonly string[]> = {
	en: ['one', 'other'],
	de: ['one', 'other'],
	ru: ['one', 'few', 'many', 'other'],
};

/** Match `{varName, plural, ...}` blocks. Naive but sufficient: ICU plural forms
 *  use `{...}` arms, and the regex captures the body up to the first balanced } at
 *  the same nesting depth. We post-process the body to extract category names. */
const PLURAL_BLOCK_RE = /\{\s*[a-zA-Z_$][\w$]*\s*,\s*plural\s*,([\s\S]*?)\}\s*\}/g;

function extractCategories(body: string): Set<string> {
	const cats = new Set<string>();
	// Each arm is `name {...}` — match `=N` and named categories at depth 0.
	const armRe = /(?:=\d+|zero|one|two|few|many|other)(?=\s*\{)/g;
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: classic regex iteration
	while ((m = armRe.exec(body)) !== null) {
		cats.add(m[0]);
	}
	return cats;
}

function findPluralBlocks(value: string): string[] {
	const blocks: string[] = [];
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: classic regex iteration
	while ((m = PLURAL_BLOCK_RE.exec(value)) !== null) {
		blocks.push(m[1]);
	}
	return blocks;
}

function loadLocale(locale: string): Record<string, string> {
	const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
	return JSON.parse(raw);
}

describe('CLDR plural completeness', () => {
	for (const locale of Object.keys(REQUIRED)) {
		describe(`messages/${locale}.json`, () => {
			const messages = loadLocale(locale);
			const required = REQUIRED[locale];

			for (const [key, value] of Object.entries(messages)) {
				const blocks = findPluralBlocks(value);
				if (blocks.length === 0) continue;

				it(`'${key}' has all required CLDR categories (${required.join('/')})`, () => {
					for (const block of blocks) {
						const present = extractCategories(block);
						for (const cat of required) {
							expect(present.has(cat), `missing '${cat}' in plural for '${key}': "${value}"`).toBe(true);
						}
					}
				});
			}
		});
	}
});
