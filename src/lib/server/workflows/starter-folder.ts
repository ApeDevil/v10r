import { strToU8, type Zippable, zipSync } from 'fflate';
import writeExcelFile from 'write-excel-file/universal';
import type { Locale } from '#lib/i18n/index.ts';
import { findWorkflow } from '#lib/workflows/catalog.ts';

/**
 * A starter folder is the example job folder a tutorial works in, offered as a zip so the
 * reader starts from a filled-in folder instead of an empty one. Its files live at
 * `content/workflows/<category>/<slug>/starter/<locale>/<folder name>/…`; the one directory
 * under the locale is the folder the reader unpacks, named in the reader's language.
 *
 * Office files are kept as text sources so they stay reviewable: `name.xlsx.json` is a
 * workbook source (`WorkbookSource`) written into the zip as `name.xlsx`, and `name.docx.md`
 * is a plain document (`#`/`##` headings, `-` list items, paragraphs) written as `name.docx`.
 * Every starter has the folder skeleton the tutorials teach, even where a folder starts empty.
 */
const starterSources = import.meta.glob('/content/workflows/*/*/starter/*/**/*', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

/** The folders every job folder has, whether or not the starter puts files in them. */
const JOB_FOLDER_SKELETON = ['input', 'tools', 'output'];

const WORKBOOK_SOURCE_SUFFIX = '.xlsx.json';
const DOCUMENT_SOURCE_SUFFIX = '.docx.md';

/** A workbook written from text: each sheet's rows, header first. Numbers stay numbers. */
export interface WorkbookSource {
	sheets: { name: string; rows: (string | number | null)[][] }[];
}

export interface StarterFolder {
	/** The folder's name in the reader's language, also the zip's file name. */
	folderName: string;
	zip: Uint8Array;
}

function starterRoot(category: string, slug: string, locale: Locale): string {
	return `/content/workflows/${category}/${slug}/starter/${locale}/`;
}

/** The starter's files for one locale, keyed by their path inside the folder name. */
function starterFiles(category: string, slug: string, locale: Locale): Map<string, string> {
	const root = starterRoot(category, slug, locale);
	const files = new Map<string, string>();
	for (const [path, text] of Object.entries(starterSources)) {
		if (path.startsWith(root)) files.set(path.slice(root.length), text);
	}
	return files;
}

function columnWidths(rows: WorkbookSource['sheets'][number]['rows']): { width: number }[] {
	const widths: number[] = [];
	for (const row of rows) {
		row.forEach((value, i) => {
			widths[i] = Math.max(widths[i] ?? 8, Math.min(50, String(value ?? '').length + 2));
		});
	}
	return widths.map((width) => ({ width }));
}

async function writeWorkbookSource(source: WorkbookSource): Promise<Uint8Array> {
	const blob = await writeExcelFile(
		source.sheets.map((sheet) => ({
			sheet: sheet.name,
			stickyRowsCount: 1,
			columns: columnWidths(sheet.rows),
			data: sheet.rows.map((row, r) =>
				row.map((value) => {
					const fontWeight = r === 0 ? ('bold' as const) : undefined;
					if (value === null) return null;
					return typeof value === 'number' ? { value, type: Number, fontWeight } : { value, type: String, fontWeight };
				}),
			),
		})),
	).toBlob();
	return new Uint8Array(await blob.arrayBuffer());
}

function xmlText(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** One Word paragraph; `size` is in half-points, as WordprocessingML counts it. */
function docxParagraph(text: string, style: { bold?: boolean; size?: number } = {}): string {
	const props = `${style.bold ? '<w:b/>' : ''}${style.size ? `<w:sz w:val="${style.size}"/>` : ''}`;
	return `<w:p><w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r></w:p>`;
}

/** The smallest .docx Word opens: one document part, no styles, headings as bold runs. */
function writeDocumentSource(source: string): Uint8Array {
	const paragraphs: string[] = [];
	let text: string[] = [];
	const endText = () => {
		if (text.length > 0) paragraphs.push(docxParagraph(text.join(' ')));
		text = [];
	};
	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (line.startsWith('## ')) {
			endText();
			paragraphs.push(docxParagraph(line.slice(3), { bold: true, size: 26 }));
		} else if (line.startsWith('# ')) {
			endText();
			paragraphs.push(docxParagraph(line.slice(2), { bold: true, size: 32 }));
		} else if (line.startsWith('- ')) {
			endText();
			text = [`• ${line.slice(2)}`];
		} else if (line === '') {
			endText();
		} else {
			text.push(line);
		}
	}
	endText();
	const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
	return zipSync({
		'[Content_Types].xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
		),
		'_rels/.rels': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
		),
		'word/document.xml': strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${ns}"><w:body>${paragraphs.join('')}</w:body></w:document>`,
		),
	});
}

/** The starter folder of `slug` in `locale`, zipped; null when the tutorial has none. */
export async function buildStarterFolder(slug: string, locale: Locale): Promise<StarterFolder | null> {
	const card = findWorkflow(slug);
	if (!card) return null;
	const files = starterFiles(card.category, slug, locale);
	if (files.size === 0) return null;

	const folderNames = new Set([...files.keys()].map((path) => path.split('/')[0]));
	if (folderNames.size !== 1) {
		throw new Error(`starter ${slug}/${locale} must hold exactly one folder, found ${[...folderNames].join(', ')}`);
	}
	const [folderName] = folderNames;

	const entries: Zippable = {};
	for (const folder of JOB_FOLDER_SKELETON) entries[`${folderName}/${folder}/`] = new Uint8Array();
	for (const [path, text] of files) {
		if (path.endsWith(WORKBOOK_SOURCE_SUFFIX)) {
			const workbookPath = path.slice(0, -'.json'.length);
			entries[workbookPath] = await writeWorkbookSource(JSON.parse(text) as WorkbookSource);
		} else if (path.endsWith(DOCUMENT_SOURCE_SUFFIX)) {
			entries[path.slice(0, -'.md'.length)] = writeDocumentSource(text);
		} else {
			entries[path] = strToU8(text);
		}
	}
	return { folderName, zip: zipSync(entries, { level: 9 }) };
}
