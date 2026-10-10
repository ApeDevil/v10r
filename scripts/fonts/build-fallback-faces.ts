#!/usr/bin/env bun
/**
 * Metric-matched fallback faces — writes src/lib/styles/font-fallbacks.css.
 *
 * Every web font here is `font-display: swap`: text paints at once in a local font and
 * re-lays-out when the web font arrives. With an unadjusted fallback that swap moves
 * lines (CLS) and can register a second, later LCP candidate for the same text. Each
 * generated face points at a local font and overrides its size and vertical metrics so
 * it occupies the web font's box; the swap then changes glyph shapes, not geometry.
 *
 * Which families get one is measured, not assumed. Lab, 412 px viewport, two long docs
 * pages, mean shift of text blocks between fallback and web-font rendering
 * (recorded in PERFORMANCE_AUDIT_2026_10.md):
 *   - Sans body faces cut the swap shift 37–62% (Nunito 136 → 85 px, Inter 30 → 18 px,
 *     Space Grotesk under Playfair 50 → 19 px) and are neutral in headings.
 *   - The serif display faces made it WORSE (Fraunces headings 19 → 30 px; Playfair
 *     with its body fallback 19 → 33 px). Both render as bold headings and Fraunces at a
 *     large optical size, so metrics from the regular default instance mislead. They are
 *     left out on purpose: `SERIF_DISPLAY_WITHOUT_FALLBACK` names them for the gate.
 *
 * Method (the one `next/font` and fontaine use):
 *   size-adjust     = (web avg width / web UPM) / (fallback avg width / fallback UPM)
 *   ascent-override = web hhea ascender / web UPM / size-adjust   (same for descent, line gap)
 * "Average width" is the advance of a–z and space weighted by English letter frequency —
 * the text people actually read — at the font's default instance (wght 400).
 *
 * Web-font metrics are read from the fontsource woff2 files on every run, so a package
 * update re-derives them. Fallback metrics are constants: they were measured with this
 * same parser from Liberation Sans and Mono, which are metric-compatible clones of
 * Arial and Courier New (identical advances and vertical metrics),
 * so one set of numbers is right for whichever of the pair a device has.
 *
 *   podman exec v10r bun run scripts/fonts/build-fallback-faces.ts                  # write
 *   podman exec v10r bun run scripts/fonts/build-fallback-faces.ts --measure <file>  # print one font's metrics
 *
 * Drift is caught by src/lib/styles/font-fallbacks.gate.test.ts, which compares the
 * committed CSS with a fresh render().
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

export const OUT = 'src/lib/styles/font-fallbacks.css';

interface Metrics {
	unitsPerEm: number;
	ascender: number;
	descender: number;
	lineGap: number;
	avgWidth: number;
}

// ── sfnt / woff2 table access ────────────────────────────────────────────────

/** woff2 known-table tags, in spec order — the 6-bit index in each directory entry. */
const WOFF2_TAGS =
	'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'.split(
		/\s+/,
	);

function tablesOf(buf: Buffer): Map<string, Buffer> {
	const tables = new Map<string, Buffer>();
	const signature = buf.toString('latin1', 0, 4);
	if (signature === 'wOF2') {
		const numTables = buf.readUInt16BE(12);
		const compressedLength = buf.readUInt32BE(20);
		let at = 48;
		const base128 = () => {
			let value = 0;
			for (let i = 0; i < 5; i++) {
				const byte = buf[at++];
				value = value * 128 + (byte & 0x7f);
				if ((byte & 0x80) === 0) return value;
			}
			throw new Error('bad UIntBase128');
		};
		const entries: { tag: string; length: number }[] = [];
		for (let i = 0; i < numTables; i++) {
			const flags = buf[at++];
			const index = flags & 0x3f;
			let tag = WOFF2_TAGS[index];
			if (index === 63) {
				tag = buf.toString('latin1', at, at + 4).trimEnd();
				at += 4;
			}
			const version = flags >> 6;
			const origLength = base128();
			// glyf (10) / loca (11): version 0 means transformed; every other table: version 0 means not.
			const transformed = index === 10 || index === 11 ? version === 0 : version !== 0;
			if (transformed && tag === 'hmtx') throw new Error('transformed hmtx is not supported');
			entries.push({ tag, length: transformed ? base128() : origLength });
		}
		const stream = brotliDecompressSync(buf.subarray(at, at + compressedLength));
		let offset = 0;
		for (const { tag, length } of entries) {
			tables.set(tag, stream.subarray(offset, offset + length));
			offset += length;
		}
		return tables;
	}
	const numTables = buf.readUInt16BE(4);
	for (let i = 0; i < numTables; i++) {
		const rec = 12 + i * 16;
		const offset = buf.readUInt32BE(rec + 8);
		tables.set(
			buf.toString('latin1', rec, rec + 4).trimEnd(),
			buf.subarray(offset, offset + buf.readUInt32BE(rec + 12)),
		);
	}
	return tables;
}

/** Glyph id for a code point, from the first Unicode cmap subtable (format 4 or 12). */
function glyphLookup(cmap: Buffer): (codePoint: number) => number {
	const count = cmap.readUInt16BE(2);
	for (let i = 0; i < count; i++) {
		const platform = cmap.readUInt16BE(4 + i * 8);
		const encoding = cmap.readUInt16BE(6 + i * 8);
		if (!((platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0)) continue;
		const sub = cmap.subarray(cmap.readUInt32BE(8 + i * 8));
		const format = sub.readUInt16BE(0);
		if (format === 4) {
			const segX2 = sub.readUInt16BE(6);
			const ends = 14;
			const starts = ends + segX2 + 2;
			const deltas = starts + segX2;
			const ranges = deltas + segX2;
			return (cp) => {
				for (let s = 0; s < segX2; s += 2) {
					if (cp > sub.readUInt16BE(ends + s)) continue;
					if (cp < sub.readUInt16BE(starts + s)) return 0;
					const rangeOffset = sub.readUInt16BE(ranges + s);
					if (rangeOffset === 0) return (cp + sub.readInt16BE(deltas + s)) & 0xffff;
					const glyph = sub.readUInt16BE(ranges + s + rangeOffset + (cp - sub.readUInt16BE(starts + s)) * 2);
					return glyph === 0 ? 0 : (glyph + sub.readInt16BE(deltas + s)) & 0xffff;
				}
				return 0;
			};
		}
		if (format === 12) {
			const groups = sub.readUInt32BE(12);
			return (cp) => {
				for (let g = 0; g < groups; g++) {
					const at = 16 + g * 12;
					const start = sub.readUInt32BE(at);
					if (cp >= start && cp <= sub.readUInt32BE(at + 4)) return sub.readUInt32BE(at + 8) + (cp - start);
				}
				return 0;
			};
		}
	}
	throw new Error('no Unicode cmap subtable');
}

/** English letter frequency (%) for a–z, plus the space between words. */
const FREQUENCY: Record<string, number> = {
	a: 8.2,
	b: 1.5,
	c: 2.8,
	d: 4.3,
	e: 12.7,
	f: 2.2,
	g: 2.0,
	h: 6.1,
	i: 7.0,
	j: 0.15,
	k: 0.77,
	l: 4.0,
	m: 2.4,
	n: 6.7,
	o: 7.5,
	p: 1.9,
	q: 0.095,
	r: 6.0,
	s: 6.3,
	t: 9.1,
	u: 2.8,
	v: 0.98,
	w: 2.4,
	x: 0.15,
	y: 2.0,
	z: 0.074,
	' ': 18.0,
};

export function measure(file: string): Metrics {
	const tables = tablesOf(readFileSync(file));
	const head = tables.get('head');
	const hhea = tables.get('hhea');
	const hmtx = tables.get('hmtx');
	const cmap = tables.get('cmap');
	if (!head || !hhea || !hmtx || !cmap) throw new Error(`${file}: missing head/hhea/hmtx/cmap`);
	const numberOfHMetrics = hhea.readUInt16BE(34);
	const advance = (glyph: number) => hmtx.readUInt16BE(Math.min(glyph, numberOfHMetrics - 1) * 4);
	const glyphOf = glyphLookup(cmap);
	let weighted = 0;
	let total = 0;
	for (const [char, weight] of Object.entries(FREQUENCY)) {
		const glyph = glyphOf(char.codePointAt(0) as number);
		if (glyph === 0) throw new Error(`${file}: no glyph for "${char}"`);
		weighted += advance(glyph) * weight;
		total += weight;
	}
	return {
		unitsPerEm: head.readUInt16BE(18),
		ascender: hhea.readInt16BE(4),
		descender: hhea.readInt16BE(6),
		lineGap: hhea.readInt16BE(8),
		avgWidth: Math.round((weighted / total) * 100) / 100,
	};
}

// ── what gets generated ──────────────────────────────────────────────────────

/** Measured from Liberation Sans and Mono Regular (see header). */
const FALLBACKS = {
	sans: { local: ['Arial', 'Liberation Sans', 'Arimo'], metrics: { unitsPerEm: 2048, avgWidth: 915.53 } },
	mono: { local: ['Courier New', 'Liberation Mono', 'Cousine'], metrics: { unitsPerEm: 2048, avgWidth: 1229 } },
} as const;

/** Each web family this app loads, its fontsource package, and the fallback class it imitates. */
/** Loaded web families that deliberately get no fallback face (see header). */
export const SERIF_DISPLAY_WITHOUT_FALLBACK = ['playfair-display', 'fraunces'] as const;

export const FAMILIES = [
	{ family: 'Inter Variable', file: 'inter', fallback: 'sans' },
	{ family: 'Space Grotesk Variable', file: 'space-grotesk', fallback: 'sans' },
	{ family: 'Nunito Variable', file: 'nunito', fallback: 'sans' },
	{ family: 'JetBrains Mono Variable', file: 'jetbrains-mono', fallback: 'mono' },
] as const;

const pct = (n: number) => `${(Math.round(n * 10000) / 100).toFixed(2)}%`;

export function render(): string {
	const faces = FAMILIES.map(({ family, file, fallback }) => {
		const web = measure(`node_modules/@fontsource-variable/${file}/files/${file}-latin-wght-normal.woff2`);
		const ref = FALLBACKS[fallback].metrics;
		const sizeAdjust = web.avgWidth / web.unitsPerEm / (ref.avgWidth / ref.unitsPerEm);
		const src = FALLBACKS[fallback].local.map((name) => `local("${name}")`).join(', ');
		return [
			`/* ${family}: ${JSON.stringify(web)} */`,
			'@font-face {',
			`\tfont-family: "${family.replace(' Variable', '')} Fallback";`,
			`\tsrc: ${src};`,
			`\tsize-adjust: ${pct(sizeAdjust)};`,
			`\tascent-override: ${pct(web.ascender / web.unitsPerEm / sizeAdjust)};`,
			`\tdescent-override: ${pct(Math.abs(web.descender) / web.unitsPerEm / sizeAdjust)};`,
			`\tline-gap-override: ${pct(web.lineGap / web.unitsPerEm / sizeAdjust)};`,
			'}',
		].join('\n');
	});
	return `/* GENERATED by scripts/fonts/build-fallback-faces.ts — do not hand-edit. Regenerate after a fontsource update. */\n\n${faces.join('\n\n')}\n`;
}

if (import.meta.main) {
	const measureAt = process.argv.indexOf('--measure');
	if (measureAt > 0) {
		console.log(JSON.stringify(measure(process.argv[measureAt + 1])));
	} else {
		writeFileSync(OUT, render());
		console.log(`Wrote ${OUT}`);
	}
}
