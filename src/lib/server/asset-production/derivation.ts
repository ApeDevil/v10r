/**
 * What an asset is derived from, written into the asset itself and its report: the request's
 * digest, and the derivation key over the producing code's versions plus that request. Two
 * runs with one key must produce one byte sequence; the store relies on it.
 */
import {
	type AssetDerivation,
	type AssetProductionEngine,
	generatorFor,
	proceduralEngine,
} from '#lib/asset-production/index.ts';
import type { AssetRequest } from '#lib/schemas/asset-production.ts';
import { contentHash, derivationKey } from '#lib/server/db/content-hash.ts';

/** JSON with object keys sorted at every depth: the one text a request digest is taken over. */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, inner]) => inner !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

/** `procedural-ts@1/structural-ring@1` — the transform half of the derivation key. */
type Versioned = { id: string; version: number };
export const assetTransform = (engine: Versioned, generator: Versioned) =>
	`${engine.id}@${engine.version}/${generator.id}@${generator.version}`;

/** The label is presentation, not input: two requests that differ only in label derive one asset. */
export async function deriveAsset(
	request: AssetRequest,
	engine: AssetProductionEngine = proceduralEngine,
): Promise<AssetDerivation> {
	const { label: _label, ...input } = request;
	const text = canonicalJson(input);
	const transform = assetTransform(engine, generatorFor(request));
	return { transform, requestDigest: await contentHash(text), derivationKey: await derivationKey(transform, [text]) };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
	return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** What every produced GLB carries in `asset.extras`, whichever environment ran it. */
export async function assetExtras(request: AssetRequest): Promise<Record<string, unknown>> {
	const { transform, requestDigest, derivationKey } = await deriveAsset(request);
	return { v10r: { transform, requestDigest, derivationKey } };
}
