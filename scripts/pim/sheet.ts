#!/usr/bin/env bun
/**
 * Product sheet workflow for an AI agent, or a person, at a terminal
 * (docs/blueprint/pim/sheet-workflow.md, tutorial: docs/blueprint/pim/tutorial.md).
 *
 * Works on plain folders — no git, no repo, no database, no provider key. One folder per
 * supplier (a "job folder") holds the export, `target.json` and `recipe.json`; every run
 * writes a dated folder under `output/` with the review workbook and copies of the recipe
 * and target it used, so the folder itself is the history.
 *
 *   pim example <folder>             Write the worked example (a supplier export + target.json) into <folder>.
 *   pim profile <folder|sheet>       The sheet's profile as JSON — what the agent reads instead of rows.
 *   pim check   <folder|sheet>       Every rule the sheet breaks against target.json, grouped. Exit 1 when a row fails.
 *   pim run     <folder|sheet>       Run recipe.json over every row; write output/<date-time>/ and print a summary.
 *
 * With a sheet path instead of a folder, name the other files: --target t.json --recipe r.json
 * --out out.xlsx|csv. `--sheet <tab>` picks a worksheet of an .xlsx file (default: the first).
 *
 * In the repo: `bun run pim …`. For office machines: `bun run pim:build` compiles this file into
 * one program per OS under dist/pim/ — copy it next to the job folders; nothing else to install.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import * as v from 'valibot';
import exampleTarget from '../../src/lib/server/pim/fixtures/shop-target.json' with { type: 'text' };
import exampleSheet from '../../src/lib/server/pim/fixtures/supplier-sheet.csv' with { type: 'text' };
import {
	applyRecipe,
	checkSheet,
	groupIssues,
	ProductDataError,
	type ProductSheet,
	parseCsv,
	parseTransformRecipe,
	productSheetFromTable,
	productSheetToTable,
	profileSheet,
	readWorkbookTable,
	runWorkbookSheets,
	type SheetCheck,
	type TargetSchema,
	targetSchemaSchema,
	toCsv,
	writeWorkbook,
} from '../../src/lib/server/pim/index.ts';

const USAGE = `Usage: pim <example|profile|check|run> <job folder | sheet.xlsx|csv>
  [--target target.json] [--recipe recipe.json] [--out out.xlsx|csv] [--sheet tab]`;

const SHEET_TYPES = new Set(['.xlsx', '.csv']);
const OUTPUT_DIR = 'output';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message: string): never {
	console.error(message);
	process.exit(2);
}

/** Where each file of a job is: explicit flags win; a folder supplies the rest by convention. */
interface JobFiles {
	sheet: string;
	target?: string;
	recipe?: string;
	/** The folder dated outputs go under; unset when the input was a single file. */
	folder?: string;
}

function resolveJob(input: string): JobFiles {
	if (!existsSync(input)) fail(`Not found: ${input}`);
	if (!statSync(input).isDirectory()) return { sheet: input, target: arg('target'), recipe: arg('recipe') };

	const sheets = readdirSync(input).filter((f) => SHEET_TYPES.has(extname(f).toLowerCase()) && !f.startsWith('~$'));
	if (sheets.length !== 1) {
		fail(
			sheets.length === 0
				? `${input} holds no .xlsx or .csv file. Put the supplier export there (save an .xls as .xlsx first).`
				: `${input} holds ${sheets.length} sheets (${sheets.join(', ')}); keep one export per folder.`,
		);
	}
	const inFolder = (name: string) => (existsSync(join(input, name)) ? join(input, name) : undefined);
	return {
		sheet: join(input, sheets[0]),
		target: arg('target') ?? inFolder('target.json'),
		recipe: arg('recipe') ?? inFolder('recipe.json'),
		folder: input,
	};
}

async function readProductSheet(path: string): Promise<ProductSheet> {
	const ext = extname(path).toLowerCase();
	if (ext === '.csv') return productSheetFromTable(parseCsv(readFileSync(path, 'utf8')));
	if (ext === '.xlsx') {
		const bytes = readFileSync(path);
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
		return productSheetFromTable(await readWorkbookTable(buffer, arg('sheet') ?? 1));
	}
	return fail(`Unsupported file type "${ext}": use .xlsx or .csv (save an .xls as .xlsx first).`);
}

function readJson(path: string): unknown {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (err) {
		return fail(`${path} is not valid JSON: ${err instanceof Error ? err.message : err}`);
	}
}

function readTarget(path: string): TargetSchema {
	const parsed = v.safeParse(targetSchemaSchema, readJson(path));
	if (!parsed.success) fail(`${path} is not a target schema: ${parsed.issues[0].message}`);
	return parsed.output;
}

function checkSummary(check: SheetCheck) {
	return {
		rowsWithIssues: check.rowsWithIssues,
		missingColumns: check.missingColumns,
		extraColumns: check.extraColumns,
		issues: groupIssues(check),
	};
}

/** `2026-10-27-1655` in local time — sorts by name, readable in Explorer and Finder. */
function stamp(date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

function writeExample(folder: string): void {
	mkdirSync(folder, { recursive: true });
	for (const [name, content] of [
		['supplier-sheet.csv', exampleSheet],
		['target.json', exampleTarget],
	] as const) {
		const path = join(folder, name);
		if (existsSync(path)) fail(`${path} already exists; choose an empty folder.`);
		writeFileSync(path, content);
	}
	console.log(`Wrote ${folder}/supplier-sheet.csv and ${folder}/target.json. Next: pim profile ${folder}`);
}

const [command, input] = process.argv.slice(2);
if (!command || !input || input.startsWith('--')) fail(USAGE);

try {
	if (command === 'example') {
		writeExample(input);
		process.exit(0);
	}
	const job = resolveJob(input);
	const sheet = await readProductSheet(job.sheet);
	switch (command) {
		case 'profile':
			console.log(JSON.stringify(profileSheet(sheet), null, 2));
			break;
		case 'check': {
			const targetPath = job.target ?? fail('check needs a target.json in the folder, or --target <file>');
			const check = checkSheet(sheet, readTarget(targetPath));
			console.log(JSON.stringify(checkSummary(check), null, 2));
			if (check.rowsWithIssues > 0) process.exit(1);
			break;
		}
		case 'run': {
			const recipePath = job.recipe ?? fail('run needs a recipe.json in the folder, or --recipe <file>');
			const recipe = parseTransformRecipe(readJson(recipePath), sheet.columns);
			const run = applyRecipe(sheet, recipe);
			const check = job.target ? checkSheet(run.sheet, readTarget(job.target)) : undefined;

			let out = arg('out');
			if (!out) {
				if (!job.folder) fail('run on a single file needs --out <file.xlsx|csv>');
				const base = join(job.folder, OUTPUT_DIR, stamp());
				let dir = base;
				for (let n = 2; existsSync(dir); n++) dir = `${base}-${n}`;
				mkdirSync(dir, { recursive: true });
				copyFileSync(recipePath, join(dir, 'recipe.json'));
				if (job.target) copyFileSync(job.target, join(dir, 'target.json'));
				out = join(dir, `${basename(job.sheet, extname(job.sheet))}-review.xlsx`);
			}
			if (extname(out).toLowerCase() === '.csv') writeFileSync(out, toCsv(productSheetToTable(run.sheet)));
			else writeFileSync(out, await writeWorkbook(runWorkbookSheets({ recipe, run, check })));

			console.log(
				JSON.stringify(
					{
						out,
						rows: { in: sheet.rows.length, out: run.sheet.rows.length },
						ops: run.reports.map((r) => ({
							op: r.opIndex + 1,
							description: r.description,
							changed: r.changed,
							unresolved: r.unresolvedCount,
							...(r.unresolved.length > 0 ? { examples: r.unresolved.slice(0, 5) } : {}),
							...(r.removedLines.length > 0 ? { removedLines: r.removedLines } : {}),
						})),
						...(check ? { check: checkSummary(check) } : {}),
					},
					null,
					2,
				),
			);
			break;
		}
		default:
			fail(USAGE);
	}
} catch (err) {
	if (err instanceof ProductDataError) fail(`${err.kind}: ${err.message}`);
	throw err;
}
