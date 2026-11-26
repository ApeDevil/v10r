#!/usr/bin/env bun
/**
 * MCP 3D token cost — what one modeling interaction costs in the model's context, per approach.
 *
 * Tokenizer: `gpt-tokenizer` o200k_base (OpenAI's GPT-4o / o-series encoding). It is an
 * ESTIMATE for any other model: Claude's tokenizer is not public, and provider-reported usage
 * (which includes system prompts and the host's own wrapping) is not measured here. Ratios
 * between approaches are the meaningful output; absolute numbers are approximate.
 *
 * Measured, per workload (enclosure, bracket, perforated panel):
 *  - the tools/list payload (MCP 3D) and the one-time describe_modeling answer;
 *  - generate_model arguments and answer (text + structuredContent, as the wire carries them);
 *  - modify_model arguments (model + parameter patch) and answer;
 *  - a refusal answer (the corrective-iteration cost);
 *  - the baselines in token-baselines/ (Blender Python, Three.js + three-bvh-csg, JSCAD);
 *  - the alternative of advertising the full model JSON Schema in tools/list;
 *  - a whole session (tools/list + instructions + describe_modeling + one generate + three
 *    modify rounds) per client presentation, and what the viewer link costs in it — the input
 *    to the "link in app-only `_meta`" decision (parametric-modeling.md § Token cost).
 *
 *   bun run scripts/asset-production/modeling-tokens.ts [--json]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toJsonSchema } from '@valibot/to-json-schema';
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

// The registry imports its View document with Vite's `?raw`; teach Bun the same.
Bun.plugin({
	name: 'raw',
	setup(build) {
		build.onResolve({ filter: /\?raw$/ }, (args) => ({
			path: join(dirname(args.importer), args.path.replace(/\?raw$/, '')),
			namespace: 'raw',
		}));
		build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({
			contents: `export default ${JSON.stringify(readFileSync(args.path, 'utf8'))};`,
			loader: 'js',
		}));
	},
});

const { modelingRegistry } = await import('../../src/lib/server/mcp/modeling/tools.ts');
const { exampleModel } = await import('../../src/lib/showcases/3d/mcp/example-models.ts');
const { parametricModelSchema } = await import('../../src/lib/schemas/parametric-model.ts');
const { canonicalJson } = await import('../../src/lib/utils/canonical-json.ts');

const tokens = (text: string) => encode(text).length;
const registry = modelingRegistry('https://v10r.dev');
const wire = (result: unknown) => JSON.stringify(result);

const toolsList = wire({ tools: registry.tools });
const fullSchemaList = wire({
	tools: registry.tools.map((tool) =>
		tool.name === 'generate_model'
			? {
					...tool,
					inputSchema: {
						type: 'object',
						properties: { model: toJsonSchema(parametricModelSchema, { errorMode: 'ignore' }) },
					},
				}
			: tool,
	),
});
const describe = await registry.dispatch('describe_modeling', {});
const describeText = describe.content[0].text;

const PATCHES = {
	enclosure: { parameters: { height: 60 } },
	bracket: { parameters: { thickness: 8 } },
	perforated: { parameters: { columns: 10 } },
} as const;

const BASELINE_DIR = join(import.meta.dir, 'token-baselines');
const baseline = (name: string) => tokens(readFileSync(join(BASELINE_DIR, name), 'utf8'));

/** The answer text minus its viewer-link line. */
const withoutLink = (text: string) =>
	text
		.split('\n')
		.filter((line) => !line.startsWith('- View, edit parameters'))
		.join('\n');

const MODIFY_ROUNDS = 3;

const workloads = [];
for (const id of Object.keys(PATCHES) as (keyof typeof PATCHES)[]) {
	const model = exampleModel(id).model;
	const generateArgs = canonicalJson({ model });
	const generated = await registry.dispatch('generate_model', { model });
	const modifyArgs = canonicalJson({ model, patch: PATCHES[id] });
	const modified = await registry.dispatch('modify_model', { model, patch: PATCHES[id] });
	workloads.push({
		id,
		definition: tokens(canonicalJson(model)),
		definitionPretty: tokens(JSON.stringify(model, null, 2)),
		generateArgs: tokens(generateArgs),
		generateResultText: tokens(generated.content[0].text),
		generateResultStructured: tokens(wire(generated.structuredContent)),
		generateResultWire: tokens(wire(generated)),
		patchOnly: tokens(canonicalJson(PATCHES[id])),
		viewerUrl: tokens(String(generated.structuredContent?.viewerUrl)),
		modifyArgs: tokens(modifyArgs),
		modifyResultText: tokens(modified.content[0].text),
		modifyResultStructured: tokens(wire(modified.structuredContent)),
		modifyResultWire: tokens(wire(modified)),
		// Without the viewer link: what an App-capable host would see if the link moved to `_meta`.
		generateTextWithoutLink: tokens(withoutLink(generated.content[0].text)),
		generateStructuredWithoutLink: tokens(wire({ ...generated.structuredContent, viewerUrl: undefined })),
		modifyTextWithoutLink: tokens(withoutLink(modified.content[0].text)),
		modifyStructuredWithoutLink: tokens(wire({ ...modified.structuredContent, viewerUrl: undefined })),
		blender: baseline(`${id}.blender.py.txt`),
		threeJs: baseline(`${id}.three.js.txt`),
		jscad: baseline(`${id}.jscad.js.txt`),
	});
}

const refusal = await registry.dispatch('generate_model', {
	model: { version: 1, units: 'mm', operations: [{ id: 'a', op: 'box', size: [10, '$w', 10] }], output: 'a' },
});

const report = {
	tokenizer: 'gpt-tokenizer o200k_base (GPT-4o encoding) — an estimate for other models, not provider-reported usage',
	date: new Date().toISOString().slice(0, 10),
	oneTime: {
		toolsList: tokens(toolsList),
		toolsListWithFullModelSchema: tokens(fullSchemaList),
		describeModeling: tokens(describeText),
		instructions: tokens((await import('../../src/lib/server/mcp/modeling/tools.ts')).MCP_3D_INSTRUCTIONS),
	},
	refusalWire: tokens(wire(refusal)),
	workloads,
};

const oneTimeTotal = report.oneTime.toolsList + report.oneTime.instructions + report.oneTime.describeModeling;
/** One session per presentation: text-only client, structuredContent-only (Claude Code), both. */
const sessions = workloads.map((w) => {
	const session = (gen: number, mod: number) =>
		oneTimeTotal + w.generateArgs + gen + MODIFY_ROUNDS * (w.modifyArgs + mod);
	return {
		id: w.id,
		text: session(w.generateResultText, w.modifyResultText),
		structured: session(w.generateResultStructured, w.modifyResultStructured),
		wire: session(w.generateResultWire, w.modifyResultWire),
		textWithoutLink: session(w.generateTextWithoutLink, w.modifyTextWithoutLink),
		wireLinkOnce: session(
			w.generateResultText + w.generateStructuredWithoutLink,
			w.modifyResultText + w.modifyStructuredWithoutLink,
		),
		wireWithoutLink: session(
			w.generateTextWithoutLink + w.generateStructuredWithoutLink,
			w.modifyTextWithoutLink + w.modifyStructuredWithoutLink,
		),
	};
});
Object.assign(report, { modifyRounds: MODIFY_ROUNDS, sessions });

if (process.argv.includes('--json')) {
	console.log(JSON.stringify(report, null, 2));
} else {
	console.log(`# MCP 3D token cost — ${report.tokenizer}, ${report.date}\n`);
	const o = report.oneTime;
	console.log(
		`One-time: tools/list ${o.toolsList} (with the full model JSON Schema inline: ${o.toolsListWithFullModelSchema}) · instructions ${o.instructions} · describe_modeling ${o.describeModeling}. A refusal answer: ${report.refusalWire}.\n`,
	);
	console.log(
		'Answers: "text" is what a text-only client shows the model, "struct" what Claude Code shows (structuredContent only), "wire" both.\n',
	);
	console.log(
		'| workload | definition | generate args | generate answer text / struct / wire | viewer link | patch | modify args | modify answer text / struct / wire | Blender Python | Three.js + CSG | JSCAD |',
	);
	console.log('|---|---|---|---|---|---|---|---|---|---|---|');
	for (const w of workloads) {
		console.log(
			`| ${w.id} | ${w.definition} | ${w.generateArgs} | ${w.generateResultText} / ${w.generateResultStructured} / ${w.generateResultWire} | ${w.viewerUrl} | ${w.patchOnly} | ${w.modifyArgs} | ${w.modifyResultText} / ${w.modifyResultStructured} / ${w.modifyResultWire} | ${w.blender} | ${w.threeJs} | ${w.jscad} |`,
		);
	}
	console.log(
		`\nSession: tools/list + instructions + describe_modeling + generate + ${MODIFY_ROUNDS} × modify, arguments included.\n`,
	);
	console.log('| workload | text | struct | wire (both) | text, no link | wire, link once | wire, no link |');
	console.log('|---|---|---|---|---|---|---|');
	for (const s of sessions) {
		console.log(
			`| ${s.id} | ${s.text} | ${s.structured} | ${s.wire} | ${s.textWithoutLink} | ${s.wireLinkOnce} | ${s.wireWithoutLink} |`,
		);
	}
}
