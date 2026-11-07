/**
 * LEAK-GATE — the privacy showcase is a pattern and must never carry a real identity.
 *
 * v10r.dev's binding legal pages (`/impressum`, `/privacy`) read the site-operator
 * record in `#lib/server/legal`. The showcase renders `templateController` instead. This
 * gate keeps the split: no showcase file reads the operator record, and every email it
 * names is an @example.com placeholder.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { templateController } from './template-controller.ts';

const PRIVACY_SHOWCASE_DIR = join(process.cwd(), 'src/routes/[[locale=locale]]/(public)/showcases/privacy');
const TEMPLATE_FILE = join(process.cwd(), 'src/lib/showcases/privacy/template-controller.ts');

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (full.endsWith('.svelte') || full.endsWith('.ts')) out.push(full);
	}
	return out;
}

// Import syntax only: comments may name the record to point a reader at it.
const OPERATOR_IMPORT = /(?:from\s+['"]|import\s*\(\s*['"])#lib\/server\/legal\b/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

describe('privacy showcase leak-gate', () => {
	const files = [...walk(PRIVACY_SHOWCASE_DIR), TEMPLATE_FILE];
	const rel = (f: string) => f.replace(process.cwd(), '.');
	const sources = files.map((file) => ({ file, src: readFileSync(file, 'utf8') }));

	it('scans a non-empty route tree', () => {
		expect(files.length).toBeGreaterThan(1);
	});

	it('no file reads the site-operator record', () => {
		expect(sources.filter(({ src }) => OPERATOR_IMPORT.test(src)).map(({ file }) => rel(file))).toEqual([]);
	});

	it('only references @example.com emails', () => {
		const offenders = sources.flatMap(({ file, src }) =>
			(src.match(EMAIL_RE) ?? []).filter((e) => !e.endsWith('@example.com')).map((e) => `${rel(file)} — ${e}`),
		);
		expect(offenders).toEqual([]);
	});

	it('the template controller is a placeholder', () => {
		expect(templateController.email.endsWith('@example.com')).toBe(true);
		expect(templateController.name).toMatch(/example/i);
	});

	it('the matchers actually fire (guards against a silently dead regex)', () => {
		expect(OPERATOR_IMPORT.test(`import { siteOperator } from '#lib/server/legal/index.ts';`)).toBe(true);
		expect('a@evil.com'.match(EMAIL_RE)).toEqual(['a@evil.com']);
	});
});
