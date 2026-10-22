/**
 * What a primitive's `finish` role draws as: physically based material parameters, and the
 * procedural maps that break up a perfectly uniform surface.
 *
 * The maps are generated, not shipped: tileable value noise written into `DataTexture`s, so a
 * scene needs no image download and no DOM, and the same seed always gives the same pixels.
 * They are grey on purpose — colour stays a design token (`tone`), and a map only modulates
 * roughness, relief or brightness. Each map is built once, on first use, and shared by every
 * material that asks for it.
 */
import { DataTexture, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

/** Material parameters for one finish; `texture` names the map its roughness and relief vary by. */
export interface SurfaceFinish {
	roughness: number;
	metalness: number;
	clearcoat: number;
	clearcoatRoughness: number;
	texture?: 'grain' | 'brushed';
	bumpScale: number;
}

const FINISHES: Record<string, SurfaceFinish> = {
	/** Powder coat, plastic housings, plaster. */
	matte: { roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, texture: 'grain', bumpScale: 0.4 },
	/** Stove enamel and painted steel: a soft sheen under a thin lacquer. */
	satin: { roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3, texture: 'grain', bumpScale: 0.2 },
	/** Glass and display covers. */
	gloss: { roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, bumpScale: 0 },
	/** Chrome and polished fittings. */
	metal: { roughness: 0.16, metalness: 1, clearcoat: 0, clearcoatRoughness: 0, bumpScale: 0 },
	/** Brushed steel, drawn copper, cast brass. */
	brushed: { roughness: 0.34, metalness: 1, clearcoat: 0, clearcoatRoughness: 0, texture: 'brushed', bumpScale: 0.15 },
};

/** A primitive without a `finish`, or with one this renderer does not know. */
export const DEFAULT_FINISH = 'satin';

export const surfaceFinish = (finish: string | undefined): SurfaceFinish =>
	FINISHES[finish ?? DEFAULT_FINISH] ?? FINISHES[DEFAULT_FINISH];

// ── Procedural maps ───────────────────────────────────────────────────────────

/**
 * `grain` and `brushed` vary a product's roughness. The room's surfaces: `plaster` (relief and
 * roughness), and one glazed floor tile in three maps — `tile` (brightness), `tile-roughness`
 * (glaze against grout) and `tile-relief` (the grout joint sits lower).
 */
export type SurfaceTexture = 'grain' | 'brushed' | 'plaster' | 'tile' | 'tile-roughness' | 'tile-relief';

/** An integer hash to [0, 1): deterministic, so every render of a scene is the same. */
function hash(x: number, y: number, seed: number): number {
	let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise on a `cells` × `cells` lattice that wraps, so the texture tiles without a seam. */
function valueNoise(u: number, v: number, cells: number, seed: number): number {
	const x = u * cells;
	const y = v * cells;
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const [tx, ty] = [smooth(x - x0), smooth(y - y0)];
	const at = (i: number, j: number) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
	const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
	const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
	return top + (bottom - top) * ty;
}

/** Octaves of value noise, normalised back to [0, 1]. */
function fractalNoise(u: number, v: number, cells: number, octaves: number, seed: number): number {
	let sum = 0;
	let weight = 0;
	for (let octave = 0; octave < octaves; octave++) {
		const amplitude = 0.5 ** octave;
		sum += valueNoise(u, v, cells * 2 ** octave, seed + octave) * amplitude;
		weight += amplitude;
	}
	return sum / weight;
}

const TILE_GROUT = 0.025;
const isGrout = (u: number, v: number) => Math.min(u, 1 - u, v, 1 - v) < TILE_GROUT;

/** Each texture's size and its grey level (0–1) at a texel centre. */
const PATTERNS: Record<SurfaceTexture, { size: number; level: (u: number, v: number) => number }> = {
	grain: { size: 128, level: (u, v) => 0.82 + 0.18 * fractalNoise(u, v, 16, 3, 1) },
	// Long streaks along U: each row's own brightness, stretched by a slow noise along the row.
	brushed: {
		size: 256,
		level: (u, v) => 0.7 + 0.18 * hash(0, Math.floor(v * 256), 7) + 0.12 * fractalNoise(u * 0.125, v, 64, 2, 9),
	},
	plaster: { size: 256, level: (u, v) => 0.75 + 0.25 * fractalNoise(u, v, 8, 5, 21) },
	tile: {
		size: 256,
		level: (u, v) => (isGrout(u, v) ? 0.62 : 0.9 + 0.1 * fractalNoise(u, v, 4, 3, 33)),
	},
	'tile-roughness': { size: 256, level: (u, v) => (isGrout(u, v) ? 1 : 0.3 + 0.1 * fractalNoise(u, v, 8, 2, 41)) },
	'tile-relief': { size: 256, level: (u, v) => (isGrout(u, v) ? 0 : 1) },
};

const built = new Map<SurfaceTexture, DataTexture>();

/**
 * The shared map for `kind`. Never dispose it: every material that asks gets the same one. A
 * caller that needs its own `repeat` takes a `clone()` — that shares the pixels — and disposes
 * the clone.
 */
export function surfaceTexture(kind: SurfaceTexture): DataTexture {
	const existing = built.get(kind);
	if (existing) return existing;
	const { size, level } = PATTERNS[kind];
	const data = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const value = Math.round(255 * Math.min(1, Math.max(0, level((x + 0.5) / size, (y + 0.5) / size))));
			data.set([value, value, value, 255], (y * size + x) * 4);
		}
	}
	const texture = new DataTexture(data, size, size);
	texture.wrapS = RepeatWrapping;
	texture.wrapT = RepeatWrapping;
	texture.minFilter = LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.anisotropy = 4;
	// Only `tile` is seen as colour (it multiplies a token); the rest are data.
	texture.colorSpace = kind === 'tile' ? SRGBColorSpace : NoColorSpace;
	texture.needsUpdate = true;
	built.set(kind, texture);
	return texture;
}
