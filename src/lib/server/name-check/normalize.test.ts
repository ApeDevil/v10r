import { describe, expect, it } from 'vitest';
import { normalizeName } from './normalize';

describe('normalizeName', () => {
	it('folds the spec example to its compact form', () => {
		const name = normalizeName('The Velo-Raptor!');
		expect(name.compact).toBe('veloraptor');
		expect(name.canonical).toBe('velo raptor');
		expect(name.tokens).toEqual(['velo', 'raptor']);
		expect(name.raw).toBe('The Velo-Raptor!');
	});

	it('strips accents and folds ß, so registry spellings meet typed ones', () => {
		expect(normalizeName('Straße Café').compact).toBe('strassecafe');
		expect(normalizeName('Velóra').compact).toBe('velora');
	});

	it('drops trailing legal forms, including post-fold Estonian OÜ', () => {
		expect(normalizeName('Velora OÜ').compact).toBe('velora');
		expect(normalizeName('Velora Holdings GmbH').compact).toBe('velora');
		expect(normalizeName('Blue Fox Interactive Ltd.').canonical).toBe('blue fox interactive');
	});

	it('keeps a legal form that is the whole name', () => {
		expect(normalizeName('Inc').compact).toBe('inc');
		expect(normalizeName('The').compact).toBe('the');
	});

	it('keeps non-Latin letters instead of destroying them', () => {
		expect(normalizeName('Велора').compact).toBe('велора');
	});
});
