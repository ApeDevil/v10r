/**
 * Probe-galaxy layout — pure math from a `ProbeReport` to unit-space geometry.
 *
 * Star/dust POSITIONS are illustrative (the page says so); everything else is
 * report-truthful: one sector per corpus, star radius = rank, the cutoff arc sits
 * exactly between the last chosen and first passed-over rank, degenerate corpora
 * (skipped / zero hits) keep their sector. Deterministic by construction — no
 * `Math.random`, all jitter is seeded from corpus names — so redraws never
 * re-scatter and tests can pin output.
 *
 * Coordinates: center (0,0), radius 0..1 (the component scales to the canvas).
 * `r` on stars is the draw radius in CSS px, not unit space.
 */

import type { ProbeCorpus, ProbeReport } from '$lib/types/context-probe';

export const R_INNER = 0.3;
export const R_OUTER = 0.92;
export const DUST_MAX = 120;

export interface GalaxySector {
	corpus: ProbeCorpus;
	startAngle: number;
	endAngle: number;
	kind: 'ran' | 'skipped' | 'empty';
}

export interface GalaxyStar {
	x: number;
	y: number;
	/** Draw radius in CSS px. */
	r: number;
	chosen: boolean;
	/** 0..1 alpha driver — from `score` when the corpus exposes one, flat default otherwise. */
	brightness: number;
	corpusIndex: number;
	rank: number;
}

export interface GalaxyDust {
	x: number;
	y: number;
	alpha: number;
}

export interface GalaxyCutoffArc {
	corpusIndex: number;
	radius: number;
}

export interface GalaxyLayout {
	sectors: GalaxySector[];
	stars: GalaxyStar[];
	cutoffArcs: GalaxyCutoffArc[];
	dust: GalaxyDust[];
}

/** FNV-1a 32-bit — stable string → seed. */
export function hashSeed(s: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		hash ^= s.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Mulberry32 — tiny deterministic PRNG over a 32-bit seed, uniform [0,1). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Monotone rank → radius: rank 0 at R_INNER, last slot at R_OUTER. */
export function rankRadius(rank: number, slots: number): number {
	const span = Math.max(slots - 1, 1);
	return R_INNER + (R_OUTER - R_INNER) * (Math.min(rank, span) / span);
}

function dustCount(documents: number, chunks: number | undefined): number {
	const basis = chunks ?? documents * 10;
	if (basis <= 0) return 0;
	return Math.min(DUST_MAX, Math.max(8, Math.ceil(Math.sqrt(basis))));
}

export function layoutGalaxy(report: ProbeReport): GalaxyLayout {
	const corpusCount = report.corpora.length;
	const sectors: GalaxySector[] = [];
	const stars: GalaxyStar[] = [];
	const cutoffArcs: GalaxyCutoffArc[] = [];
	const dust: GalaxyDust[] = [];
	if (corpusCount === 0) return { sectors, stars, cutoffArcs, dust };

	const span = (Math.PI * 2) / corpusCount;
	const pad = span * 0.12;

	report.corpora.forEach((corpus, corpusIndex) => {
		const startAngle = -Math.PI / 2 + corpusIndex * span;
		const endAngle = startAngle + span;
		const kind = !corpus.ran ? 'skipped' : corpus.candidates.length === 0 ? 'empty' : 'ran';
		sectors.push({ corpus: corpus.corpus, startAngle, endAngle, kind });

		if (kind !== 'ran') return;

		const slots = corpus.candidates.length;
		corpus.candidates.forEach((candidate, rank) => {
			const jitter = mulberry32(hashSeed(`${corpus.corpus}:${rank}`));
			const angle = startAngle + pad + jitter() * (span - pad * 2);
			const radius = rankRadius(rank, slots);
			stars.push({
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
				r: candidate.chosen ? 4 : 3,
				chosen: candidate.chosen,
				brightness: candidate.score === undefined ? 0.7 : Math.min(Math.max(candidate.score, 0.35), 1),
				corpusIndex,
				rank,
			});
		});

		if (slots > corpus.cutoff) {
			const lo = corpus.cutoff > 0 ? rankRadius(corpus.cutoff - 1, slots) : R_INNER * 0.6;
			const hi = rankRadius(corpus.cutoff, slots);
			cutoffArcs.push({ corpusIndex, radius: (lo + hi) / 2 });
		}
	});

	// Dust density comes from the real inventory counts; positions are decorative.
	for (const inv of report.inventory) {
		const corpusIndex = report.corpora.findIndex((l) => l.corpus === inv.corpus);
		if (corpusIndex === -1) continue;
		const sector = sectors[corpusIndex];
		const count = dustCount(inv.documents, inv.chunks);
		const rand = mulberry32(hashSeed(`dust:${inv.corpus}`));
		for (let i = 0; i < count; i++) {
			const angle = sector.startAngle + rand() * (sector.endAngle - sector.startAngle);
			const radius = 0.15 + rand() * 0.85;
			dust.push({
				x: Math.cos(angle) * radius,
				y: Math.sin(angle) * radius,
				alpha: 0.15 + rand() * 0.35,
			});
		}
	}

	return { sectors, stars, cutoffArcs, dust };
}
