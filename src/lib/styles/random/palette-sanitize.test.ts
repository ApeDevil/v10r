import { describe, expect, it } from 'vitest';
import { OKLCH_RE, safeEntries, VALID_TOKEN_KEYS } from './palette-sanitize';

describe('OKLCH_RE', () => {
	it('accepts well-formed oklch triples', () => {
		expect(OKLCH_RE.test('oklch(0.5 0.1 200)')).toBe(true);
		expect(OKLCH_RE.test('oklch( 0.62  0.19  29 )')).toBe(true);
	});

	it('rejects every injection / breakout payload', () => {
		const XSS_CORPUS = [
			'oklch(0.5 0.1 200); }</style><script>alert(1)</script>',
			'oklch(0.5 0.1 200)}',
			'oklch(0.5 0.1 200)\n}',
			'oklch(0.5 0.1 200) !important',
			'red; background: url(javascript:alert(1))',
			'expression(alert(1))',
			'var(--x)',
			'#fff',
			'rgb(0,0,0)',
			'oklch(0.5 0.1 200)/**/',
			'',
		];
		for (const payload of XSS_CORPUS) {
			expect(OKLCH_RE.test(payload), `should reject: ${payload}`).toBe(false);
		}
	});
});

describe('safeEntries', () => {
	it('keeps only allowlisted keys with clean oklch values', () => {
		const out = safeEntries({
			bg: 'oklch(0.5 0.1 200)', // valid key + value → kept
			evil: 'oklch(0.5 0.1 200)', // unknown key → dropped
			fg: 'red', // valid key, bad value → dropped
			primary: 'oklch(0.62 0.19 29)', // kept
		});
		expect(out.map(([k]) => k).sort()).toEqual(['bg', 'primary']);
	});

	it('drops a value that tries to break out of the style block', () => {
		const out = safeEntries({ bg: 'oklch(0.5 0.1 200)}</style><script>x</script>' });
		expect(out).toEqual([]);
	});

	it('VALID_TOKEN_KEYS does not contain attacker-suggestive keys', () => {
		expect(VALID_TOKEN_KEYS.has('bg')).toBe(true);
		expect(VALID_TOKEN_KEYS.has('content')).toBe(false);
		expect(VALID_TOKEN_KEYS.has('--evil')).toBe(false);
	});
});
