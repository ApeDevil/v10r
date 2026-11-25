/**
 * The complete outgoing arguments: every value whole, canonical key order, invisible characters
 * escaped — and parsing the document back always gives the value the approval digest names.
 */
import { describe, expect, it } from 'vitest';
import { externalArgumentBytes, externalOutgoingDocument } from './outgoing-arguments';
import { externalArgumentsDigest } from './prepare';

describe('externalOutgoingDocument', () => {
	it('keeps every value whole and sorts keys the canonical way', () => {
		const value = 'v'.repeat(5000);
		const document = externalOutgoingDocument({ z: 1, a: { y: value, b: [true, null] } });
		expect(document).toContain(value);
		expect(document.indexOf('"a"')).toBeLessThan(document.indexOf('"z"'));
		expect(document.indexOf('"b"')).toBeLessThan(document.indexOf('"y"'));
	});

	it('writes invisible characters as escapes, so nothing hides or reorders text on screen', () => {
		const sneaky = `ok${String.fromCharCode(0x202e)}gpj.exe${String.fromCharCode(0x200b)}`;
		const document = externalOutgoingDocument({ name: sneaky, bom: String.fromCharCode(0xfeff) });
		expect(document).toContain('\\u202e');
		expect(document).toContain('\\u200b');
		expect(document).toContain('\\ufeff');
		expect(document).not.toContain(String.fromCharCode(0x202e));
		// The escapes are JSON for the same characters: the value and its digest are unchanged.
		expect(JSON.parse(document).name).toBe(sneaky);
	});

	it('parses back to a value with the same digest, whatever the input order or characters', () => {
		const cases: unknown[] = [
			{ key: 'k', value: 'v' },
			{ b: 2, a: 1, nested: { d: [3, { y: 'é', x: '😀' }], c: '\u0007' } },
			{ text: `line1\nline2\t${String.fromCharCode(0x2066)}x` },
			[],
			{},
		];
		for (const args of cases) {
			expect(externalArgumentsDigest(JSON.parse(externalOutgoingDocument(args)))).toBe(externalArgumentsDigest(args));
		}
	});

	it('counts bytes of the canonical form the peer receives', () => {
		expect(externalArgumentBytes({ b: 'é', a: 1 })).toBe(Buffer.byteLength('{"a":1,"b":"é"}'));
	});
});
