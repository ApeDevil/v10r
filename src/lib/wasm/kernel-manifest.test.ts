/**
 * Freshness gate: the committed wasm artifacts must correspond to the committed
 * crate sources. kernel-parity.test.ts compares the JS twins against the
 * artifact — but a Rust-only edit leaves the artifact stale and parity green.
 * This closes that hole without putting Rust in the gate: scripts/wasm/build.sh
 * records sha256 hashes of its inputs and outputs in build-manifest.json, and
 * this test recomputes them. Red means: run scripts/wasm/build.sh (host-side)
 * and commit the regenerated kernel directory.
 *
 * ── Honest limits ── The manifest proves "current files == files present when
 * build.sh last ran", trusting build.sh to hash what it built from. It cannot
 * prove the binary semantically implements lib.rs; byte-diffing a pinned
 * container rebuild is the stronger, slower check and stays manual.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface BuildManifest {
	image: string;
	bindgenVersion: string;
	inputs: Record<string, string>;
	outputs: Record<string, string>;
}

const repoRoot = new URL('../../../', import.meta.url);
const kernelDir = new URL('./kernel/', import.meta.url);

const manifest: BuildManifest = JSON.parse(await readFile(new URL('build-manifest.json', kernelDir), 'utf8'));

async function sha256(url: URL): Promise<string> {
	return createHash('sha256')
		.update(await readFile(url))
		.digest('hex');
}

describe('wasm artifact freshness', () => {
	it.each(Object.entries(manifest.inputs))('input %s is unchanged since the last build', async (path, hash) => {
		await expect(sha256(new URL(path, repoRoot))).resolves.toBe(hash);
	});

	it.each(Object.entries(manifest.outputs))('artifact %s matches what build.sh emitted', async (name, hash) => {
		await expect(sha256(new URL(name, kernelDir))).resolves.toBe(hash);
	});

	it('pins one wasm-bindgen version across Cargo.toml, build.sh and the manifest', async () => {
		const cargo = await readFile(new URL('crates/kernel/Cargo.toml', repoRoot), 'utf8');
		expect(cargo).toContain(`wasm-bindgen = "=${manifest.bindgenVersion}"`);
		const buildSh = await readFile(new URL('scripts/wasm/build.sh', repoRoot), 'utf8');
		expect(buildSh).toContain(`BINDGEN_VERSION="${manifest.bindgenVersion}"`);
		expect(buildSh).toContain(`RUST_IMAGE="${manifest.image}"`);
	});
});
