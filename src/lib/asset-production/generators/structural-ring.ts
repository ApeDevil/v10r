/**
 * The structural ring: a square-section truss bent into a ring around a hub, joined to it by
 * spokes, with pressurised modules on the outer chords. Deterministic — no randomness, no
 * clock — so the same parameters always give the same vertices.
 *
 * Layout: the ring lies in the XZ plane around +Y. Each bay station `i` sits at angle
 * `2πi / bays`; its four section corners are inner/outer × bottom/top. Bracing patterns:
 * `warren` alternates the diagonal per bay, `pratt` runs every diagonal the same way (the
 * single-direction variant — a closed ring has no midspan), `x-brace` uses both diagonals.
 */
import { Vector3 } from 'three';
import type { StructuralRingParameters } from '#lib/schemas/asset-production.ts';
import { type AssetDiagnostic, assetDiagnostic } from '../diagnostics.ts';
import { BOX_COST, type GeneratedMesh, MeshBuilder, type MeshCost, tubeCost } from '../mesh.ts';
import type { AssetGenerator } from './generator.ts';

/** Bump whenever a change to this file can change one output byte. */
const VERSION = 1;

/** Section corners: [radial offset sign, height sign]. */
const CORNERS = [
	[-1, -1],
	[-1, 1],
	[1, -1],
	[1, 1],
] as const;
/** The four faces of a bay, as pairs of corner indices. */
const FACES = [
	[0, 1], // inner
	[2, 3], // outer
	[0, 2], // bottom
	[1, 3], // top
] as const;

const hubHeight = (p: StructuralRingParameters) => Math.max(p.trussHeight * 1.5, p.hubRadius * 1.2);
const hubSegments = (p: StructuralRingParameters) => p.detail * 4;
const portLength = (p: StructuralRingParameters) => hubHeight(p) * 0.25;
const spokeRadius = (p: StructuralRingParameters) => p.strutRadius * 1.5;
const diagonalsPerFace = (p: StructuralRingParameters) => (p.bracing === 'x-brace' ? 2 : 1);

/** Which bays carry a module: spread evenly, first bay included. */
function moduleBays(p: StructuralRingParameters): number[] {
	return Array.from({ length: p.modules }, (_, k) => Math.floor((k * p.bays) / p.modules));
}

function moduleSize(p: StructuralRingParameters) {
	const outer = p.ringRadius + p.trussDepth / 2;
	const length = 2 * outer * Math.sin(Math.PI / p.bays) * 0.8;
	return { length, height: p.trussHeight * 0.9, depth: Math.min(p.trussDepth, length) * 0.6 };
}

function check(p: StructuralRingParameters): AssetDiagnostic[] {
	const findings: AssetDiagnostic[] = [];
	const innerFace = p.ringRadius - p.trussDepth / 2;
	if (p.spokes === 1) {
		findings.push(
			assetDiagnostic('parameter.conflict', 'spokes', 'Use no spokes or at least two: one spoke cannot hold the ring.'),
		);
	}
	if (p.spokes > 0 && p.hubRadius >= innerFace - 2 * p.strutRadius) {
		findings.push(
			assetDiagnostic(
				'parameter.conflict',
				'hubRadius',
				`The hub must end inside the truss (inner face at ${innerFace.toFixed(2)} m).`,
			),
		);
	}
	if (p.strutRadius * 4 > Math.min(p.trussDepth, p.trussHeight)) {
		findings.push(
			assetDiagnostic(
				'parameter.conflict',
				'strutRadius',
				'Members are too thick for the truss section: keep 4 × radius within depth and height.',
			),
		);
	}
	const bayLength = 2 * innerFace * Math.sin(Math.PI / p.bays);
	if (bayLength < 4 * p.strutRadius) {
		findings.push(
			assetDiagnostic(
				'parameter.conflict',
				'bays',
				'Bays are shorter than four member radii: use fewer bays or a larger ring.',
			),
		);
	}
	if (p.modules > p.bays) {
		findings.push(assetDiagnostic('parameter.conflict', 'modules', 'There can be at most one module per bay.'));
	}
	return findings;
}

function estimate(p: StructuralRingParameters): MeshCost {
	const tube = tubeCost(p.detail);
	const struts = p.bays * (4 + 4 + 4 * diagonalsPerFace(p));
	const spokes = p.spokes * 2;
	const hub = tubeCost(hubSegments(p));
	const ports = tubeCost(p.detail * 2);
	return {
		vertices: (struts + spokes) * tube.vertices + hub.vertices + 2 * ports.vertices + p.modules * BOX_COST.vertices,
		triangles:
			(struts + spokes) * tube.triangles + hub.triangles + 2 * ports.triangles + p.modules * BOX_COST.triangles,
	};
}

/** An upper bound of where geometry may lie, from the parameters alone. */
function envelope(p: StructuralRingParameters): GeneratedMesh['envelope'] {
	const modules = p.modules > 0 ? moduleSize(p).depth + p.strutRadius : 0;
	// A facet's corner sits on the member's radius, so `strutRadius` covers every member.
	const radial = p.ringRadius + p.trussDepth / 2 + Math.max(p.strutRadius, modules) + 1e-4;
	const reach = Math.max(radial, p.hubRadius);
	const height =
		Math.max(p.trussHeight / 2 + Math.max(p.strutRadius, spokeRadius(p)), hubHeight(p) / 2 + portLength(p)) + 1e-4;
	return { min: [-reach, -height, -reach], max: [reach, height, reach] };
}

function generate(p: StructuralRingParameters, checkpoint: () => void): GeneratedMesh {
	const radial = (i: number) => {
		const angle = (2 * Math.PI * i) / p.bays;
		return new Vector3(Math.cos(angle), 0, Math.sin(angle));
	};
	const nodes: Vector3[][] = Array.from({ length: p.bays }, (_, i) =>
		CORNERS.map(([r, h]) =>
			radial(i)
				.multiplyScalar(p.ringRadius + (r * p.trussDepth) / 2)
				.setY((h * p.trussHeight) / 2),
		),
	);

	const truss = new MeshBuilder('truss', 'structure');
	for (let i = 0; i < p.bays; i++) {
		checkpoint();
		const here = nodes[i];
		const next = nodes[(i + 1) % p.bays];
		for (let c = 0; c < 4; c++) truss.tube(here[c], next[c], p.strutRadius, p.detail);
		for (const [a, b] of FACES) truss.tube(here[a], here[b], p.strutRadius, p.detail);
		for (const [a, b] of FACES) {
			const flip = p.bracing === 'warren' && i % 2 === 1;
			if (p.bracing === 'x-brace') {
				truss.tube(here[a], next[b], p.strutRadius, p.detail);
				truss.tube(here[b], next[a], p.strutRadius, p.detail);
			} else if (flip) {
				truss.tube(here[b], next[a], p.strutRadius, p.detail);
			} else {
				truss.tube(here[a], next[b], p.strutRadius, p.detail);
			}
		}
	}

	const primitives = [truss.build()];

	if (p.spokes > 0) {
		const spokes = new MeshBuilder('spokes', 'structure');
		const innerFace = p.ringRadius - p.trussDepth / 2;
		for (let k = 0; k < p.spokes; k++) {
			checkpoint();
			// Offset half a bay so a spoke meets the inner face between frames, not through a node.
			const angle = (2 * Math.PI * k) / p.spokes + Math.PI / p.bays;
			const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle));
			for (const level of [-1, 1]) {
				const y = (level * p.trussHeight) / 4;
				spokes.tube(
					direction
						.clone()
						.multiplyScalar(p.hubRadius * 0.9)
						.setY(y),
					direction.clone().multiplyScalar(innerFace).setY(y),
					spokeRadius(p),
					p.detail,
				);
			}
		}
		primitives.push(spokes.build());
	}

	const hub = new MeshBuilder('hub', 'hub');
	const half = hubHeight(p) / 2;
	hub.tube(new Vector3(0, -half, 0), new Vector3(0, half, 0), p.hubRadius, hubSegments(p));
	for (const sign of [-1, 1]) {
		hub.tube(
			new Vector3(0, sign * half, 0),
			new Vector3(0, sign * (half + portLength(p)), 0),
			p.hubRadius * 0.35,
			p.detail * 2,
		);
	}
	primitives.push(hub.build());

	if (p.modules > 0) {
		checkpoint();
		const modules = new MeshBuilder('modules', 'module');
		const size = moduleSize(p);
		for (const bay of moduleBays(p)) {
			const angle = (2 * Math.PI * (bay + 0.5)) / p.bays;
			const out = new Vector3(Math.cos(angle), 0, Math.sin(angle));
			const tangent = new Vector3(-Math.sin(angle), 0, Math.cos(angle));
			// The bay's outer chords are straight, so the midpoint between nodes lies inside the arc.
			const chordMid = Math.cos(Math.PI / p.bays) * (p.ringRadius + p.trussDepth / 2);
			const center = out.clone().multiplyScalar(chordMid + p.strutRadius + size.depth / 2);
			// Right-handed: out × up = tangent.
			modules.box(center, [out, new Vector3(0, 1, 0), tangent], [size.depth / 2, size.height / 2, size.length / 2]);
		}
		primitives.push(modules.build());
	}

	return { primitives, envelope: envelope(p) };
}

export const structuralRingGenerator: AssetGenerator<StructuralRingParameters> = {
	id: 'structural-ring',
	version: VERSION,
	label: 'Structural ring',
	check,
	estimate,
	generate,
};
