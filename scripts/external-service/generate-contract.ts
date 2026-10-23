/**
 * openapi.json → TypeScript types, the second link of the contract chain.
 *
 *   services/runtime-lab/src/contract.rs  (authority)
 *     └─ cargo test pins → services/runtime-lab/openapi.json
 *          └─ this script → src/lib/showcases/external-service/contract.generated.ts
 *               └─ contract.ts valibot mirrors, held to these types by the compiler
 *
 *   bun run external-service:contract           write the types, record a new release
 *   bun run external-service:contract --check   exit 1 when either committed file is stale
 *
 * Types, plus one string: `CONTRACT_RELEASE`, the spec's `info.version` — the release of
 * the contract this app is built against, which the service client compares with the
 * `release` a running service reports (`contract-skew.ts`). Only server code reads it; the
 * page imports types only, so the browser bundle gains nothing.
 *
 * It also keeps `contract-releases.json`: release → digest of the spec without its version
 * line. Append-only — a release already recorded is never rewritten — so a contract change
 * that forgot to bump the version fails here and in `contract-freshness.test.ts`, and a
 * patch release cannot change the contract (`releaseRecordProblems`).
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

export const SPEC_PATH = 'services/runtime-lab/openapi.json';
export const TYPES_PATH = 'src/lib/showcases/external-service/contract.generated.ts';
export const RELEASES_PATH = 'services/runtime-lab/contract-releases.json';

/** Release → contract digest, oldest first. */
export interface ContractReleaseRecord {
	_comment: string;
	releases: Record<string, string>;
}

const RECORD_COMMENT =
	'Append-only, written by bun run external-service:contract: each runtime-lab release and the sha256 of its OpenAPI document without info.version. A release is never rewritten; releases sharing major.minor must share a digest (a patch never changes the contract). See docs/blueprint/architecture/external-service.md#evolving-the-contract.';

export function specRelease(specText: string): string {
	return JSON.parse(specText).info.version;
}

/** The contract itself: the spec with its version line removed, hashed. */
export function contractDigest(specText: string): string {
	const spec = JSON.parse(specText);
	delete spec.info.version;
	return createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}

/** Why a record is inconsistent with a spec — empty when it is consistent. */
export function releaseRecordProblems(record: ContractReleaseRecord, specText: string): string[] {
	const release = specRelease(specText);
	const digest = contractDigest(specText);
	const problems: string[] = [];
	if (record.releases[release] === undefined) {
		problems.push(`release ${release} is not recorded — run: bun run external-service:contract`);
	} else if (record.releases[release] !== digest) {
		problems.push(`the contract changed under release ${release} — bump the version in Cargo.toml`);
	}
	const line = (version: string) => version.split('.').slice(0, 2).join('.');
	const byLine = new Map<string, string>();
	for (const [version, recorded] of Object.entries(record.releases)) {
		const seen = byLine.get(line(version));
		if (seen !== undefined && seen !== recorded) {
			problems.push(
				`releases ${line(version)}.x carry different contracts — a contract change needs a minor or major bump`,
			);
		}
		byLine.set(line(version), recorded);
	}
	return problems;
}

const HEADER = `/**
 * GENERATED — do not edit. Source: ${SPEC_PATH}
 * Regenerate: bun run external-service:contract
 */

`;

export async function renderContractTypes(specText: string): Promise<string> {
	const ast = await openapiTS(JSON.parse(specText));
	const release = `\n/** The contract release this app is built against (\`info.version\`). */\nexport const CONTRACT_RELEASE = '${specRelease(specText)}';\n`;
	return HEADER + astToString(ast) + release;
}

if (import.meta.main) {
	const specText = await readFile(SPEC_PATH, 'utf8');
	const rendered = await renderContractTypes(specText);
	const record: ContractReleaseRecord = JSON.parse(
		await readFile(RELEASES_PATH, 'utf8').catch(() => JSON.stringify({ _comment: RECORD_COMMENT, releases: {} })),
	);
	if (process.argv.includes('--check')) {
		const committed = await readFile(TYPES_PATH, 'utf8').catch(() => '');
		const problems = releaseRecordProblems(record, specText);
		if (committed !== rendered) problems.push(`${TYPES_PATH} is stale — run: bun run external-service:contract`);
		for (const problem of problems) console.error(problem);
		if (problems.length > 0) process.exit(1);
		console.log(`${TYPES_PATH} and ${RELEASES_PATH} are current`);
	} else {
		await writeFile(TYPES_PATH, rendered);
		console.log(`wrote ${TYPES_PATH}`);
		const release = specRelease(specText);
		// Append, never rewrite: a recorded release is history, and rewriting it would let a
		// contract change slip in under a version a deployed service already reports.
		if (record.releases[release] === undefined) {
			record.releases[release] = contractDigest(specText);
			await writeFile(RELEASES_PATH, `${JSON.stringify({ ...record, _comment: RECORD_COMMENT }, null, '\t')}\n`);
			console.log(`recorded release ${release} in ${RELEASES_PATH}`);
		}
		const problems = releaseRecordProblems(record, specText);
		for (const problem of problems) console.error(problem);
		if (problems.length > 0) process.exit(1);
	}
}
