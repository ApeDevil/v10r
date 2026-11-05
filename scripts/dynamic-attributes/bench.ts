#!/usr/bin/env bun
/**
 * Dynamic attributes measurements: codec parse, canonical serialize, one operation, a three-way
 * merge and a diagnostics pass, for records of 10, 50 and 200 attributes (200 is the default
 * limit). Numbers are from the machine it runs on; the docs quote a dated run and say where.
 *
 *   bun run attributes:bench [--runs 2000]
 */
import {
	type AttributeRecord,
	addAttribute,
	checkAttributeRecord,
	coreAttributeKinds,
	createAttributeEngine,
	emptyAttributeRecord,
	mergeAttributeRecords,
	parseAttributeRecordText,
	relabelAttribute,
	serializeAttributeRecord,
	setAttributeValue,
} from '../../src/lib/dynamic-attributes/index.ts';

const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 2000;
const engine = createAttributeEngine(coreAttributeKinds);
const KINDS = ['text', 'number', 'boolean', 'date', 'select', 'list', 'multiline'] as const;
const VALUES: Record<(typeof KINDS)[number], unknown> = {
	text: 'A value of ordinary length',
	number: 42.5,
	boolean: true,
	date: '2026-11-05',
	select: null,
	list: ['alpha', 'beta', 'gamma'],
	multiline: 'Line one\nLine two\nLine three',
};

function recordOf(size: number): AttributeRecord {
	let record = emptyAttributeRecord();
	for (let i = 0; i < size; i++) {
		const kind = KINDS[i % KINDS.length];
		const added = addAttribute(record, { label: `Attribute ${i}`, kind }, engine);
		if (!added.ok) throw new Error(added.refusal);
		const set = setAttributeValue(added.record, added.attributeId, VALUES[kind] as never, engine);
		if (!set.ok) throw new Error(set.refusal);
		record = set.record;
	}
	return record;
}

function measure(fn: () => unknown): { median: number; p95: number } {
	for (let i = 0; i < Math.min(200, runs); i++) fn();
	const times: number[] = [];
	for (let i = 0; i < runs; i++) {
		const start = performance.now();
		fn();
		times.push(performance.now() - start);
	}
	times.sort((a, b) => a - b);
	return { median: times[Math.floor(runs / 2)], p95: times[Math.floor(runs * 0.95)] };
}

const us = (ms: number) => `${(ms * 1000).toFixed(1)} µs`;
const rows: string[][] = [];
for (const size of [10, 50, 200]) {
	const record = recordOf(size);
	const text = serializeAttributeRecord(record);
	const middle = record.attributes[Math.floor(size / 2)].id;
	const local = relabelAttribute(record, middle, 'Local label', engine);
	const remote = setAttributeValue(record, record.attributes[0].id, 'Remote value', engine);
	if (!local.ok || !remote.ok) throw new Error('setup');
	const cases: [string, () => unknown][] = [
		['parse (text → record)', () => parseAttributeRecordText(text, { kinds: engine.kinds })],
		['serialize (canonical)', () => serializeAttributeRecord(record)],
		['relabel one attribute', () => relabelAttribute(record, middle, 'Renamed', engine)],
		['three-way merge', () => mergeAttributeRecords(record, local.record, remote.record, engine.limits.removed)],
		['diagnostics', () => checkAttributeRecord(record, engine.kinds)],
	];
	for (const [name, fn] of cases) {
		const { median, p95 } = measure(fn);
		rows.push([String(size), `${new TextEncoder().encode(text).length} B`, name, us(median), us(p95)]);
	}
}

console.log(`runtime: Bun ${Bun.version}, ${process.platform}/${process.arch}, ${runs} runs per case\n`);
console.log('| Attributes | Bytes | Case | Median | p95 |');
console.log('|---:|---:|---|---:|---:|');
for (const row of rows) console.log(`| ${row.join(' | ')} |`);
