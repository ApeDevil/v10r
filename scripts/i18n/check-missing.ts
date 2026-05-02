#!/usr/bin/env bun
/**
 * Missing-key lint for i18n message files.
 *
 * EN is the canonical source. For each non-EN locale, list keys present in
 * en.json but absent in <locale>.json (and vice versa, for orphaned keys).
 * Exits non-zero on any divergence so it's CI-safe.
 *
 * Run via: `bun run i18n:check-missing`
 *
 * Note: this is NOT a translation script. The translations themselves are
 * authored by the AI in the dev loop alongside the EN edits. This script just
 * catches the case where an edit forgot to update one of the locales.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MESSAGES_DIR = join(process.cwd(), 'messages');
const BASE = 'en';
const NON_BASE = ['de', 'ru'] as const;

function load(locale: string): Record<string, unknown> {
	const path = join(MESSAGES_DIR, `${locale}.json`);
	const raw = readFileSync(path, 'utf8');
	return JSON.parse(raw);
}

function diffKeys(a: Set<string>, b: Set<string>): string[] {
	const out: string[] = [];
	for (const k of a) if (!b.has(k)) out.push(k);
	out.sort();
	return out;
}

const enKeys = new Set(Object.keys(load(BASE)));

let fail = false;

for (const locale of NON_BASE) {
	const localeKeys = new Set(Object.keys(load(locale)));

	const missing = diffKeys(enKeys, localeKeys);
	const orphaned = diffKeys(localeKeys, enKeys);

	if (missing.length > 0) {
		fail = true;
		console.error(`\n[i18n] ${locale}.json is MISSING ${missing.length} key(s) present in en.json:`);
		for (const k of missing) console.error(`  - ${k}`);
	}
	if (orphaned.length > 0) {
		fail = true;
		console.error(`\n[i18n] ${locale}.json has ${orphaned.length} ORPHANED key(s) not in en.json:`);
		for (const k of orphaned) console.error(`  - ${k}`);
	}
}

if (fail) {
	console.error('\n[i18n] Add the missing translations or remove orphaned keys, then re-run.');
	process.exit(1);
}

console.log('[i18n] OK — en/de/ru key sets are in sync.');
