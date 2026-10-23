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
 * It also keeps `contract-releases.json`: release → digest of the contract (`contractDigest`).
 * Append-only — a release already recorded is never rewritten, and a release that would make
 * the record inconsistent is never written — so a contract change that forgot to bump the
 * version fails here and in `contract-freshness.test.ts`, and a patch release cannot change
 * the contract (`releaseRecordProblems`). Honest limit: the test sees the record as it is
 * now, not its history — a hand edit that rewrites or deletes a row passes; review diffs to
 * that file. A missing record is refused unless `--init` asks for a new one.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import { RELEASE_PATTERN } from '../../src/lib/server/showcases/external-service/contract-skew';

export const SPEC_PATH = 'services/runtime-lab/openapi.json';
export const TYPES_PATH = 'src/lib/showcases/external-service/contract.generated.ts';
export const RELEASES_PATH = 'services/runtime-lab/contract-releases.json';

/** Release → contract digest, oldest first. */
export interface ContractReleaseRecord {
	_comment: string;
	releases: Record<string, string>;
}

const RECORD_COMMENT =
	'Append-only, written by bun run external-service:contract: each runtime-lab release and the sha256 of its contract (the OpenAPI document without info, prose and tags, keys sorted). A release is never rewritten; releases sharing major.minor must share a digest (a patch never changes the contract). See docs/blueprint/architecture/external-service.md#evolving-the-contract.';

export function specRelease(specText: string): string {
	const release = JSON.parse(specText).info?.version;
	if (typeof release !== 'string' || !RELEASE_PATTERN.test(release)) {
		throw new Error(`info.version must be major.minor.patch, got ${JSON.stringify(release)}`);
	}
	return release;
}

/** Keys that describe the API to people and change nothing on the wire. */
const ANNOTATIONS = new Set(['description', 'summary', 'title', 'example', 'examples', 'externalDocs', 'tags']);

/**
 * The contract as data: annotations removed (except where a key is a property's name), keys
 * sorted at every level. A doc-comment edit or a generator that reorders keys is not a
 * contract change; a new field, bound, enum value or route is.
 */
function canonical(value: unknown, parentKey?: string): unknown {
	if (Array.isArray(value)) return value.map((item) => canonical(item));
	if (value === null || typeof value !== 'object') return value;
	const kept = Object.keys(value)
		.filter((key) => parentKey === 'properties' || !ANNOTATIONS.has(key))
		.sort();
	return Object.fromEntries(kept.map((key) => [key, canonical((value as Record<string, unknown>)[key], key)]));
}

/** The contract itself, hashed: the spec without `info` (name, prose, version), canonicalised. */
export function contractDigest(specText: string): string {
	const { info: _info, ...spec } = JSON.parse(specText);
	return createHash('sha256')
		.update(JSON.stringify(canonical(spec)))
		.digest('hex');
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
	const line = (version: string) => {
		const parts = RELEASE_PATTERN.exec(version);
		if (!parts) problems.push(`recorded release ${version} is not major.minor.patch`);
		return parts ? `${parts[1]}.${parts[2]}` : version;
	};
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
	const release = `\n/** The contract release this app is built against (\`info.version\`). */\nexport const CONTRACT_RELEASE = ${JSON.stringify(specRelease(specText))};\n`;
	return HEADER + astToString(ast) + release;
}

if (import.meta.main) {
	const specText = await readFile(SPEC_PATH, 'utf8');
	const rendered = await renderContractTypes(specText);
	const recordText = await readFile(RELEASES_PATH, 'utf8').catch(() => null);
	if (recordText === null && !process.argv.includes('--init')) {
		// A missing record would silently restart history with only the current release.
		console.error(`${RELEASES_PATH} is missing — restore it, or start a new one with --init`);
		process.exit(1);
	}
	const record: ContractReleaseRecord = recordText
		? JSON.parse(recordText)
		: { _comment: RECORD_COMMENT, releases: {} };
	if (process.argv.includes('--check')) {
		const committed = await readFile(TYPES_PATH, 'utf8').catch(() => '');
		const problems = releaseRecordProblems(record, specText);
		if (committed !== rendered) problems.push(`${TYPES_PATH} is stale — run: bun run external-service:contract`);
		for (const problem of problems) console.error(problem);
		if (problems.length > 0) process.exit(1);
		console.log(`${TYPES_PATH} and ${RELEASES_PATH} are current`);
	} else {
		const release = specRelease(specText);
		// Append, never rewrite: a recorded release is history, and rewriting it would let a
		// contract change slip in under a version a deployed service already reports. Checked
		// BEFORE writing: a release that breaks the rule must not become permanent history.
		const candidate =
			record.releases[release] === undefined
				? { ...record, releases: { ...record.releases, [release]: contractDigest(specText) } }
				: record;
		const problems = releaseRecordProblems(candidate, specText);
		for (const problem of problems) console.error(problem);
		if (problems.length > 0) process.exit(1);
		await writeFile(TYPES_PATH, rendered);
		console.log(`wrote ${TYPES_PATH}`);
		if (candidate !== record) {
			await writeFile(RELEASES_PATH, `${JSON.stringify({ ...candidate, _comment: RECORD_COMMENT }, null, '\t')}\n`);
			console.log(`recorded release ${release} in ${RELEASES_PATH}`);
		}
	}
}
