import { describe, expect, it } from 'vitest';
import { detectCsvSeparator, parseCsv, toCsv } from './csv-table';

describe('parseCsv', () => {
	it('reads the separator Excel used for the locale', () => {
		expect(detectCsvSeparator('a;b;c\n1;2;3')).toBe(';');
		expect(detectCsvSeparator('a,b,c\n1,2,3')).toBe(',');
		expect(parseCsv('﻿sku;title\nA-1;Rucksack, 20L\r\n')).toEqual([
			['sku', 'title'],
			['A-1', 'Rucksack, 20L'],
		]);
	});

	it('keeps quoted separators, newlines and doubled quotes inside one field', () => {
		expect(parseCsv('a,b\n"x, ""y""","line\nbreak"', ',')).toEqual([
			['a', 'b'],
			['x, "y"', 'line\nbreak'],
		]);
	});

	it('round-trips through toCsv', () => {
		const table = [
			['sku', 'title'],
			['A-1', 'Says "hi"; then, leaves'],
		];
		expect(parseCsv(toCsv(table, ';'), ';')).toEqual(table);
	});
});
