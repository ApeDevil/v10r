import { describe, expect, it } from 'vitest';
import { PROBE_EXAMPLES } from '$lib/showcases/ai/fixtures/probes';
import type { ProbeCandidate, ProbeCorpusResult, ProbeReport } from '$lib/types/context-probe';
import { DUST_MAX, layoutGalaxy, R_INNER, R_OUTER, rankRadius } from './galaxy-layout';

function makeCandidates(n: number, cutoff: number, withScores = true): ProbeCandidate[] {
	return Array.from({ length: n }, (_, i) => ({
		title: `Doc ${i}`,
		preview: `preview ${i}`,
		...(withScores ? { score: 0.8 - i * 0.05 } : {}),
		source: 'vector' as const,
		tier: '1',
		chosen: i < cutoff,
	}));
}

function makeReport(corpora: ProbeCorpusResult[], inventory: ProbeReport['inventory'] = []): ProbeReport {
	return {
		surface: 'chatbot',
		gates: [],
		inventory,
		tools: [],
		corpora,
		prompt: { blocks: [], totalTokensEst: 0 },
	};
}

describe('rankRadius', () => {
	it('is monotone in rank and stays within [R_INNER, R_OUTER]', () => {
		for (const slots of [1, 2, 6, 10]) {
			let prev = -1;
			for (let rank = 0; rank < slots; rank++) {
				const r = rankRadius(rank, slots);
				expect(r).toBeGreaterThan(prev);
				expect(r).toBeGreaterThanOrEqual(R_INNER);
				expect(r).toBeLessThanOrEqual(R_OUTER + 1e-9);
				prev = r;
			}
		}
	});

	it('places a lone candidate at R_INNER and the last slot at R_OUTER', () => {
		expect(rankRadius(0, 1)).toBe(R_INNER);
		expect(rankRadius(5, 6)).toBeCloseTo(R_OUTER);
	});
});

describe('layoutGalaxy', () => {
	it('splits the circle equally: one corpus spans the full circle, two corpora half each', () => {
		const one = layoutGalaxy(makeReport([{ corpus: 'desk', ran: true, cutoff: 5, candidates: makeCandidates(3, 3) }]));
		expect(one.sectors).toHaveLength(1);
		expect(one.sectors[0].endAngle - one.sectors[0].startAngle).toBeCloseTo(Math.PI * 2);

		const two = layoutGalaxy(
			makeReport([
				{ corpus: 'llmwiki', ran: true, cutoff: 6, candidates: makeCandidates(1, 1, false) },
				{ corpus: 'docs', ran: true, cutoff: 4, candidates: makeCandidates(6, 4) },
			]),
		);
		expect(two.sectors).toHaveLength(2);
		for (const s of two.sectors) {
			expect(s.endAngle - s.startAngle).toBeCloseTo(Math.PI);
		}
	});

	it('draws the cutoff arc strictly between the last-chosen and first-passed radii', () => {
		const layout = layoutGalaxy(
			makeReport([{ corpus: 'docs', ran: true, cutoff: 4, candidates: makeCandidates(6, 4) }]),
		);
		expect(layout.cutoffArcs).toHaveLength(1);
		const arc = layout.cutoffArcs[0];
		expect(arc.radius).toBeGreaterThan(rankRadius(3, 6));
		expect(arc.radius).toBeLessThan(rankRadius(4, 6));
	});

	it('emits no arc when the cutoff is not crossed (all candidates chosen)', () => {
		const layout = layoutGalaxy(
			makeReport([{ corpus: 'desk', ran: true, cutoff: 5, candidates: makeCandidates(2, 2) }]),
		);
		expect(layout.cutoffArcs).toHaveLength(0);
	});

	it('marks skipped corpora and emits neither stars nor arcs nor dust-free crashes for them', () => {
		const layout = layoutGalaxy(
			makeReport([{ corpus: 'docs', ran: false, skippedReason: 'gated_off', cutoff: 4, candidates: [] }]),
		);
		expect(layout.sectors[0].kind).toBe('skipped');
		expect(layout.stars).toHaveLength(0);
		expect(layout.cutoffArcs).toHaveLength(0);
	});

	it('marks ran-but-zero-hits corpora as empty', () => {
		const layout = layoutGalaxy(makeReport([{ corpus: 'llmwiki', ran: true, cutoff: 6, candidates: [] }]));
		expect(layout.sectors[0].kind).toBe('empty');
		expect(layout.stars).toHaveLength(0);
	});

	it('gives score-less candidates a finite default brightness', () => {
		const layout = layoutGalaxy(
			makeReport([{ corpus: 'llmwiki', ran: true, cutoff: 6, candidates: makeCandidates(3, 3, false) }]),
		);
		for (const star of layout.stars) {
			expect(Number.isFinite(star.brightness)).toBe(true);
			expect(star.brightness).toBeGreaterThan(0);
			expect(star.brightness).toBeLessThanOrEqual(1);
		}
	});

	it('keeps every star inside the unit disc', () => {
		for (const examples of Object.values(PROBE_EXAMPLES)) {
			for (const example of examples) {
				for (const star of layoutGalaxy(example.report).stars) {
					expect(Math.hypot(star.x, star.y)).toBeLessThanOrEqual(R_OUTER + 1e-9);
				}
			}
		}
	});

	it('caps dust per corpus and scales it from real inventory counts', () => {
		const capped = layoutGalaxy(
			makeReport(
				[{ corpus: 'docs', ran: true, cutoff: 4, candidates: makeCandidates(6, 4) }],
				[{ corpus: 'docs', documents: 148, chunks: 1_000_000 }],
			),
		);
		expect(capped.dust).toHaveLength(DUST_MAX);

		const small = layoutGalaxy(
			makeReport(
				[{ corpus: 'llmwiki', ran: true, cutoff: 6, candidates: makeCandidates(1, 1, false) }],
				[{ corpus: 'llmwiki', documents: 4 }],
			),
		);
		expect(small.dust.length).toBeGreaterThan(0);
		expect(small.dust.length).toBeLessThan(20);
	});

	it('is deterministic — identical output across calls, fixtures included', () => {
		for (const examples of Object.values(PROBE_EXAMPLES)) {
			for (const example of examples) {
				expect(layoutGalaxy(example.report)).toEqual(layoutGalaxy(example.report));
			}
		}
	});
});
