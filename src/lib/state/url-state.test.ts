import { describe, expect, it } from 'vitest';
import { readUrlState, urlParam, urlStateHref, writeUrlState } from './url-state';

const spec = {
	q: urlParam.text(),
	page: urlParam.integer({ fallback: 1, min: 1, max: 500 }),
	sort: urlParam.oneOf(['name', 'createdAt'], 'createdAt'),
	open: urlParam.flag(),
	part: urlParam.token(),
};

const read = (search: string) => readUrlState(new URLSearchParams(search), spec);

describe('readUrlState', () => {
	it('gives every param its fallback when the URL carries none', () => {
		expect(read('')).toEqual({ q: '', page: 1, sort: 'createdAt', open: false, part: null });
	});

	it('parses valid values', () => {
		expect(read('q=%20ada%20&page=3&sort=name&open=1&part=seat-cushion')).toEqual({
			q: 'ada',
			page: 3,
			sort: 'name',
			open: true,
			part: 'seat-cushion',
		});
	});

	it('turns hostile or malformed input into the fallback instead of throwing', () => {
		expect(read('page=abc&sort=drop%20table&open=true&part=%3Cscript%3E')).toEqual({
			q: '',
			page: 1,
			sort: 'createdAt',
			open: false,
			part: null,
		});
		expect(read('page=1.5').page).toBe(1);
		expect(read(`q=${'x'.repeat(500)}`).q).toHaveLength(200);
	});

	it('clamps integers into their bounds', () => {
		expect(read('page=0').page).toBe(1);
		expect(read('page=-4').page).toBe(1);
		expect(read('page=99999').page).toBe(500);
	});
});

describe('writeUrlState', () => {
	const base = new URL('https://v10r.dev/admin/users?q=ada&page=4&utm_source=mail');

	it('applies the patch over the state the URL already carries', () => {
		const next = writeUrlState(base, spec, { sort: 'name' });
		expect(next.searchParams.get('q')).toBe('ada');
		expect(next.searchParams.get('page')).toBe('4');
		expect(next.searchParams.get('sort')).toBe('name');
	});

	it('drops params equal to their fallback, so one state has one URL', () => {
		const next = writeUrlState(base, spec, { q: '', page: 1, sort: 'createdAt', open: false, part: null });
		expect([...next.searchParams.keys()]).toEqual(['utm_source']);
	});

	it('keeps params the spec does not name', () => {
		expect(writeUrlState(base, spec, { page: 2 }).searchParams.get('utm_source')).toBe('mail');
	});

	it('canonicalises invalid values already in the URL', () => {
		const dirty = new URL('https://v10r.dev/x?page=nope&sort=bogus');
		expect(writeUrlState(dirty, spec, {}).search).toBe('');
	});

	it('round-trips', () => {
		const values = { q: 'grace', page: 7, sort: 'name' as const, open: true, part: 'arm' };
		expect(readUrlState(writeUrlState(base, spec, values).searchParams, spec)).toEqual(values);
	});

	it('renders a same-origin href for links', () => {
		expect(urlStateHref(base, spec, { page: 1 })).toBe('/admin/users?q=ada&utm_source=mail');
	});
});
