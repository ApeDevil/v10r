/**
 * Where produced assets are kept: a write-once store keyed by owner and derivation key.
 *
 * Write-once is the safety rule, not an optimisation. A run never overwrites anything: the
 * same key with the same bytes is the same asset (a repeat run is idempotent and reuses it);
 * the same key with different bytes means the producing code changed without a version bump,
 * and the run is refused with `store.conflict` while the kept asset stays as it was. Keeping
 * an asset is not publishing it — a job's output is a draft the owner decides about.
 *
 * Two implementations here — memory (tests, one process) and a directory (the CLI) — and one
 * contract an S3-compatible adapter (`#lib/server/store`, Cloudflare R2 with a conditional
 * `If-None-Match: *` put) would implement for hosted storage.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export interface StoredAsset {
	key: string;
	sha256: string;
	bytes: number;
}

export type AssetPutResult =
	| { kind: 'created' | 'reused'; asset: StoredAsset }
	| { kind: 'conflict'; existing: StoredAsset };

export interface AssetStore {
	readonly id: string;
	/** Keep `glb` and its report under `key` unless something is already there. Never overwrites. */
	put(key: string, glb: Uint8Array, sha256: string, report: string): Promise<AssetPutResult>;
	get(key: string): Promise<{ glb: Uint8Array; report: string } | undefined>;
}

/** Owner ids and derivation keys only: no separators, no dots, nothing a path could climb with. */
const KEY_SEGMENT = /^[a-z0-9][a-z0-9-]{0,127}$/;

/** `<owner>/<derivationKey>` — refuses anything else, so a key can never name a path outside its owner. */
export function assetKey(owner: string, derivationKey: string): string {
	if (!KEY_SEGMENT.test(owner) || !KEY_SEGMENT.test(derivationKey)) throw new Error('Invalid asset key segment.');
	return `${owner}/${derivationKey}`;
}

export function createMemoryAssetStore(): AssetStore {
	const kept = new Map<string, { glb: Uint8Array; sha256: string; report: string }>();
	return {
		id: 'memory',
		async put(key, glb, sha256, report) {
			const existing = kept.get(key);
			if (existing) {
				const asset = { key, sha256: existing.sha256, bytes: existing.glb.byteLength };
				return existing.sha256 === sha256 ? { kind: 'reused', asset } : { kind: 'conflict', existing: asset };
			}
			kept.set(key, { glb: glb.slice(), sha256, report });
			return { kind: 'created', asset: { key, sha256, bytes: glb.byteLength } };
		},
		async get(key) {
			const entry = kept.get(key);
			return entry && { glb: entry.glb.slice(), report: entry.report };
		},
	};
}

/**
 * A directory per asset: `<root>/<owner>/<derivationKey>/asset.glb` + `report.json`. Written to
 * a temporary sibling directory renamed into place in one step, so a crash mid-write leaves no
 * half asset under the real name, and two runs racing for one key cannot both win.
 */
export function createDirectoryAssetStore(root: string): AssetStore {
	const base = resolve(root);
	const pathFor = (key: string) => {
		const path = resolve(base, key);
		if (!path.startsWith(base + sep)) throw new Error('Asset key escapes the store root.');
		return path;
	};
	const sha256Of = async (path: string) =>
		JSON.parse(await readFile(join(path, 'report.json'), 'utf8'))?.output?.sha256 as string;

	return {
		id: 'directory',
		async put(key, glb, sha256, report) {
			const path = pathFor(key);
			await mkdir(dirname(path), { recursive: true });
			const staging = `${path}.partial-${process.pid}-${Date.now()}`;
			await mkdir(staging);
			try {
				await writeFile(join(staging, 'asset.glb'), glb, { flag: 'wx' });
				await writeFile(join(staging, 'report.json'), report, { flag: 'wx' });
				try {
					// Atomic and exclusive: a directory renames onto a missing name only.
					await rename(staging, path);
				} catch {
					const existing = {
						key,
						sha256: await sha256Of(path),
						bytes: (await readFile(join(path, 'asset.glb'))).byteLength,
					};
					return existing.sha256 === sha256 ? { kind: 'reused', asset: existing } : { kind: 'conflict', existing };
				}
				return { kind: 'created', asset: { key, sha256, bytes: glb.byteLength } };
			} finally {
				await rm(staging, { recursive: true, force: true });
			}
		},
		async get(key) {
			const path = pathFor(key);
			try {
				return {
					glb: new Uint8Array(await readFile(join(path, 'asset.glb'))),
					report: await readFile(join(path, 'report.json'), 'utf8'),
				};
			} catch {
				return undefined;
			}
		},
	};
}
