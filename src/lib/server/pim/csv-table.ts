/**
 * CSV in and out, as tables of text — the other format product exports arrive in.
 *
 * Excel writes CSV with the locale's list separator, so a German export is `;`-separated and
 * an English one `,`-separated; the separator is read from the header line unless given.
 * Quoting follows RFC 4180: a quoted field may hold the separator, a newline, or `""`.
 */

/** The separator a header line most likely uses: whichever of `;`, `,` and tab occurs most. */
export function detectCsvSeparator(text: string): string {
	const header = text.split(/\r?\n/, 1)[0];
	const [best] = [';', ',', '\t'].map((sep) => ({ sep, n: header.split(sep).length - 1 })).sort((a, b) => b.n - a.n);
	return best.n > 0 ? best.sep : ',';
}

export function parseCsv(text: string, separator = detectCsvSeparator(text)): string[][] {
	const source = text.startsWith('﻿') ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < source.length; i++) {
		const ch = source[i];
		if (quoted) {
			if (ch === '"' && source[i + 1] === '"') {
				field += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"' && field === '') quoted = true;
		else if (ch === separator) {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && source[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += ch;
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

export function toCsv(table: string[][], separator = ','): string {
	const quote = (value: string) =>
		value.includes(separator) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
	return `${table.map((row) => row.map(quote).join(separator)).join('\n')}\n`;
}
