/**
 * The contract chain stays connected without putting Rust in the gate.
 *
 * - `contract.generated.ts` must equal what `openapi.json` generates today.
 * - `check-manifest.json` (written by `scripts/external-service/check.sh` only after fmt,
 *   clippy and tests pass, from hashes taken before they ran) must hash the crate's current
 *   sources, its build definition, the script itself and `openapi.json`. A Rust edit
 *   without a passing check run, a weakened check list, or an `openapi.json` edited by
 *   hand turns this red.
 * - The builder image and toolchain are pinned once across the repo's two Rust builds.
 *
 * Honest limit (as for the wasm kernel's manifest): this proves "these files passed the
 * checks when check.sh last ran", trusting the script — not that they would pass again.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	type ContractReleaseRecord,
	contractDigest,
	RELEASES_PATH,
	releaseRecordProblems,
	renderContractTypes,
	SPEC_PATH,
	specRelease,
	TYPES_PATH,
} from '../../../../../scripts/external-service/generate-contract';

interface CheckManifest {
	/** What ran the checks: `container <image>` or `host <rustc --version>`. */
	runner: string;
	checks: string;
	inputs: Record<string, string>;
	outputs: Record<string, string>;
}

const CRATE = 'services/runtime-lab';
const read = (path: string) => readFileSync(path, 'utf8');
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest: CheckManifest = JSON.parse(read(`${CRATE}/check-manifest.json`));

describe('external-service contract freshness', () => {
	it('contract.generated.ts is what openapi.json generates', async () => {
		expect(read(TYPES_PATH), 'stale — run: bun run external-service:contract').toBe(
			await renderContractTypes(read(SPEC_PATH)),
		);
	});

	it('every contract change carries a new release, and no patch release changes the contract', () => {
		const record: ContractReleaseRecord = JSON.parse(read(RELEASES_PATH));
		expect(releaseRecordProblems(record, read(SPEC_PATH))).toEqual([]);
		// The service reports Cargo's version; the spec must carry the same one.
		expect(read(`${CRATE}/Cargo.toml`)).toMatch(new RegExp(`^version = "${specRelease(read(SPEC_PATH))}"$`, 'm'));
	});

	describe('the release rule', () => {
		const spec = JSON.parse(read(SPEC_PATH));
		const record: ContractReleaseRecord = JSON.parse(read(RELEASES_PATH));
		const [major, minor, patch] = spec.info.version.split('.').map(Number);
		const withRoute = (version: string) =>
			JSON.stringify({ ...spec, info: { ...spec.info, version }, paths: { ...spec.paths, '/v1/extra': {} } });
		const recording = (specText: string) => ({
			...record,
			releases: { ...record.releases, [specRelease(specText)]: contractDigest(specText) },
		});

		it('refuses a contract change under a recorded release', () => {
			expect(releaseRecordProblems(record, withRoute(spec.info.version))).toEqual([
				expect.stringContaining(`the contract changed under release ${spec.info.version}`),
			]);
		});

		it('refuses a patch release that changes the contract', () => {
			const patched = withRoute(`${major}.${minor}.${patch + 1}`);
			expect(releaseRecordProblems(recording(patched), patched)).toEqual([
				expect.stringContaining('a contract change needs a minor or major bump'),
			]);
		});

		it('accepts a minor or major release that changes the contract', () => {
			for (const version of [`${major}.${minor + 1}.0`, `${major + 1}.0.0`]) {
				const bumped = withRoute(version);
				expect(releaseRecordProblems(recording(bumped), bumped), version).toEqual([]);
			}
		});

		it('names an unrecorded release', () => {
			const unrecorded = withRoute(`${major}.${minor + 1}.0`);
			expect(releaseRecordProblems(record, unrecorded)).toEqual([expect.stringContaining('is not recorded')]);
		});

		it('hashes the contract, not its prose or key order', () => {
			const reworded = structuredClone(spec);
			reworded.paths['/v1/evaluate'].post.description = 'Reworded for people.';
			reworded.info.title = 'renamed';
			const reordered = JSON.stringify(Object.fromEntries(Object.entries(spec).reverse()));
			expect(contractDigest(JSON.stringify(reworded))).toBe(contractDigest(read(SPEC_PATH)));
			expect(contractDigest(reordered)).toBe(contractDigest(read(SPEC_PATH)));
			expect(contractDigest(withRoute(spec.info.version))).not.toBe(contractDigest(read(SPEC_PATH)));
		});

		it('refuses a release that is not major.minor.patch', () => {
			expect(() => specRelease(JSON.stringify({ ...spec, info: { ...spec.info, version: '1.5.0-rc.1' } }))).toThrow(
				'major.minor.patch',
			);
		});
	});

	it.each(
		Object.entries({ ...manifest.inputs, ...manifest.outputs }),
	)('%s is unchanged since check.sh last passed', (path, hash) => {
		expect(sha256(path), 'run: bash scripts/external-service/check.sh').toBe(hash);
	});

	it('stamps the checks check.sh runs today, and hashes the script itself', () => {
		const script = read('scripts/external-service/check.sh');
		const declared = script.match(/^CHECKS='([^']+)'$/m)?.[1];
		expect(declared, 'check.sh must declare CHECKS on one line').toBeDefined();
		expect(manifest.checks).toBe(declared);
		for (const step of ['cargo fmt --check', 'cargo clippy', '-D warnings', 'cargo test --locked']) {
			expect(manifest.checks).toContain(step);
		}
		expect(manifest.runner).toMatch(/^(container docker\.io\/library\/rust:[^@]+@sha256:[0-9a-f]{64}|host rustc \S+)/);
	});

	it('hashes the build definition, not only the sources', () => {
		for (const required of [
			`${CRATE}/Cargo.lock`,
			`${CRATE}/Cargo.toml`,
			`${CRATE}/Containerfile`,
			// The allowlist that decides what reaches the image.
			`${CRATE}/.dockerignore`,
			`${CRATE}/rust-toolchain.toml`,
			'scripts/external-service/check.sh',
		]) {
			expect(Object.keys(manifest.inputs)).toContain(required);
		}
	});

	it('the manifest covers every source file, and only existing ones', () => {
		const sources = readdirSync(`${CRATE}/src`, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => `${entry.parentPath}/${entry.name}`);
		expect(sources.length).toBeGreaterThan(0);
		const listed = Object.keys(manifest.inputs).filter((path) => path.startsWith(`${CRATE}/src/`));
		expect(listed.sort()).toEqual(sources.sort());
		expect(Object.keys(manifest.outputs)).toEqual([SPEC_PATH]);
	});

	it('pins one Rust builder and toolchain across the repo', () => {
		const image = read('scripts/wasm/build.sh').match(/^RUST_IMAGE="([^"]+)"$/m)?.[1];
		expect(image).toMatch(/@sha256:[0-9a-f]{64}$/);
		expect(read(`${CRATE}/Containerfile`)).toContain(`ARG RUST_IMAGE=${image}`);
		expect(read('scripts/external-service/check.sh')).toContain(`RUST_IMAGE="${image}"`);
		expect(read('scripts/external-service/audit.sh')).toContain(`RUST_IMAGE="${image}"`);

		const channel = (path: string) => read(path).match(/^channel = "([^"]+)"/m)?.[1];
		expect(channel(`${CRATE}/rust-toolchain.toml`)).toBe(channel('crates/kernel/rust-toolchain.toml'));
	});
});
