import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { locales } from '#lib/i18n/index.ts';
import { buildStarterFolder } from './starter-folder';

const STARTERS = ['ai-project-folder', 'excel-with-ai', 'powerpoint-with-ai'];

describe('starter folders', () => {
	it.each(
		STARTERS.flatMap((slug) => locales.map((locale) => [slug, locale] as const)),
	)('%s (%s) unpacks into one job folder with a README and the folder skeleton', async (slug, locale) => {
		const starter = await buildStarterFolder(slug, locale);
		if (!starter) throw new Error(`no starter for ${slug}/${locale}`);
		const entries = unzipSync(starter.zip);
		const paths = Object.keys(entries);

		expect(paths.every((path) => path.startsWith(`${starter.folderName}/`))).toBe(true);
		for (const folder of ['input/', 'tools/', 'output/']) expect(paths).toContain(`${starter.folderName}/${folder}`);
		expect(strFromU8(entries[`${starter.folderName}/README.md`])).toMatch(/^# /);
		// Sources are converted, never shipped as their text form.
		expect(paths.some((path) => path.endsWith('.xlsx.json') || path.endsWith('.docx.md'))).toBe(false);
	});

	it('writes workbook and document sources as real Office files', async () => {
		const starter = await buildStarterFolder('powerpoint-with-ai', 'de');
		if (!starter) throw new Error('no starter');
		const entries = unzipSync(starter.zip);
		const input = `${starter.folderName}/input`;

		const workbook = unzipSync(entries[`${input}/q3-figures.xlsx`]);
		expect(Object.keys(workbook)).toContain('xl/workbook.xml');
		expect(strFromU8(workbook['xl/workbook.xml'])).toContain('Termintreue');

		const document = unzipSync(entries[`${input}/q3-supplier-report.docx`]);
		const body = strFromU8(document['word/document.xml']);
		expect(body).toContain('Lieferantenbericht Q3 2026');
		expect(body).toContain('• Alpenglas');
	});

	it('returns null for a workflow without a starter folder', async () => {
		expect(await buildStarterFolder('no-such-workflow', 'en')).toBeNull();
	});
});
