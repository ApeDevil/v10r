/**
 * The contract chain stays connected without putting Rust in the gate.
 *
 * - `contract.generated.ts` must equal what `openapi.json` generates today.
 * - `check-manifest.json` (written by `scripts/external-service/check.sh` only after fmt,
 *   clippy and tests pass) must hash the crate's current sources and `openapi.json`. A Rust
 *   edit without a passing check run — or an `openapi.json` edited by hand — turns this red.
 * - The builder image and toolchain are pinned once across the repo's two Rust builds.
 *
 * Honest limit (as for the wasm kernel's manifest): this proves "these files passed the
 * checks when check.sh last ran", trusting the script — not that they would pass again.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderContractTypes, SPEC_PATH, TYPES_PATH } from '../../../../../scripts/external-service/generate-contract';

interface CheckManifest {
	image: string;
	checks: string;
	inputs: Record<string, string>;
	outputs: Record<string, string>;
}

const CRATE = 'services/order-rules';
const read = (path: string) => readFileSync(path, 'utf8');
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const manifest: CheckManifest = JSON.parse(read(`${CRATE}/check-manifest.json`));

describe('external-service contract freshness', () => {
	it('contract.generated.ts is what openapi.json generates', async () => {
		expect(read(TYPES_PATH), 'stale — run: bun run external-service:contract').toBe(
			await renderContractTypes(read(SPEC_PATH)),
		);
	});

	it.each(
		Object.entries({ ...manifest.inputs, ...manifest.outputs }),
	)('%s is unchanged since check.sh last passed', (path, hash) => {
		expect(sha256(path), 'run: bash scripts/external-service/check.sh').toBe(hash);
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
		const containerfile = read(`${CRATE}/Containerfile`);
		expect(containerfile).toContain(`ARG RUST_IMAGE=${manifest.image}`);
		expect(read('scripts/external-service/check.sh')).toContain(`RUST_IMAGE="${manifest.image}"`);
		expect(read('scripts/wasm/build.sh')).toContain(`RUST_IMAGE="${manifest.image}"`);

		const channel = (path: string) => read(path).match(/^channel = "([^"]+)"/m)?.[1];
		expect(channel(`${CRATE}/rust-toolchain.toml`)).toBe(channel('crates/kernel/rust-toolchain.toml'));
	});
});
