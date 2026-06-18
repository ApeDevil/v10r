import { describe, expect, it } from 'vitest';
import { checkHoneypot, HONEYPOT_MIN_FILL_MS } from './honeypot';

describe('checkHoneypot', () => {
	it('allows a clean, human-paced submission', () => {
		const renderedAt = Date.now() - (HONEYPOT_MIN_FILL_MS + 3000);
		expect(checkHoneypot({ honeypot: '', renderedAt }).allowed).toBe(true);
		expect(checkHoneypot({ honeypot: null, renderedAt }).allowed).toBe(true);
	});

	it('denies when the honeypot field is filled (bot)', () => {
		const renderedAt = Date.now() - 10_000;
		expect(checkHoneypot({ honeypot: 'http://spam', renderedAt }).allowed).toBe(false);
	});

	it('denies a too-fast submission', () => {
		expect(checkHoneypot({ honeypot: '', renderedAt: Date.now() }).allowed).toBe(false);
	});

	it('denies a forged / non-finite renderedAt instead of letting it slip the speed check', () => {
		expect(checkHoneypot({ honeypot: '', renderedAt: Number.NaN }).allowed).toBe(false);
		expect(checkHoneypot({ honeypot: '', renderedAt: Number.POSITIVE_INFINITY }).allowed).toBe(false);
		// @ts-expect-error — exercising a malformed payload the type system would forbid
		expect(checkHoneypot({ honeypot: '', renderedAt: undefined }).allowed).toBe(false);
	});
});
