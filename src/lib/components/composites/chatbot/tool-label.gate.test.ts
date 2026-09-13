/**
 * Every manifest tool has its label message in every locale — the one human label the
 * status row reads through `toolLabel()` — and the label table names exactly the manifest's
 * tools. A tool added without its message would render as its snake_case name.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_MANIFEST, toolLabelKey } from '$lib/types/ai-tools';
import { LABELED_TOOLS } from './tool-label';

const LOCALES = ['en', 'de', 'ru'] as const;

describe('tool labels ≡ TOOL_MANIFEST', () => {
	it('the label table names exactly the manifest tools (static references keep the bundle tree-shakeable)', () => {
		expect([...LABELED_TOOLS].sort()).toEqual(TOOL_MANIFEST.map((d) => d.name).sort());
	});

	for (const locale of LOCALES) {
		it(`names every manifest tool in ${locale}`, () => {
			const messages = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as Record<
				string,
				string
			>;
			for (const descriptor of TOOL_MANIFEST) {
				const key = toolLabelKey(descriptor.name);
				expect(messages[key], `${locale}: ${key}`).toEqual(expect.any(String));
				expect(messages[key]?.length, `${locale}: ${key}`).toBeGreaterThan(0);
			}
		});
	}
});
