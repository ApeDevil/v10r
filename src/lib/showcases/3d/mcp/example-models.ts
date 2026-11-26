/**
 * The MCP 3D showcase's example models — one per workload the pattern is measured on. Each is a
 * plain `ParametricModel`, exactly what an agent sends `generate_model`; the showcase, the
 * benchmarks, the tests and the `describe_modeling` example all read them from here, so a
 * number in the docs is always about a model a visitor can open.
 */
import type { ParametricModel } from '#lib/schemas/parametric-model.ts';

export type ExampleModelId = 'primitives' | 'bracket' | 'perforated' | 'organic' | 'enclosure' | 'lamp';

export interface ExampleModel {
	id: ExampleModelId;
	/** The benchmark workload this example stands for. */
	workload: 'primitive' | 'mechanical' | 'repeated' | 'organic' | 'assembly' | 'complex';
	model: ParametricModel;
}

/** The brief's success case: a cylindrical enclosure, removable lid, four mounting holes, 3 mm walls. */
const enclosure: ParametricModel = {
	version: 1,
	name: 'Cylindrical enclosure with lid',
	units: 'mm',
	parameters: { diameter: 60, height: 40, wall: 3, lidDepth: 5, hole: 3.2, clearance: 0.2 },
	operations: [
		{ id: 'outer', op: 'cylinder', r: '$diameter / 2', h: '$height', center: false, segments: 96 },
		{
			id: 'cavity',
			op: 'cylinder',
			r: '$diameter / 2 - $wall',
			h: '$height',
			center: false,
			segments: 96,
			at: [0, 0, '$wall'],
		},
		{
			id: 'hole',
			op: 'cylinder',
			r: '$hole / 2',
			h: '$wall * 3',
			segments: 24,
			at: ['$diameter / 2 - $wall - 7', 0, 0],
		},
		{ id: 'holes', op: 'pattern.radial', of: 'hole', count: 4, rotate: [0, 0, 45] },
		{ id: 'body', op: 'subtract', from: 'outer', remove: ['cavity', 'holes'], material: 'plastic' },
		{ id: 'cap', op: 'cylinder', r: '$diameter / 2', h: '$wall', center: false, segments: 96 },
		{
			id: 'plug',
			op: 'cylinder',
			r: '$diameter / 2 - $wall - $clearance',
			h: '$lidDepth',
			center: false,
			segments: 96,
			at: [0, 0, '-$lidDepth'],
		},
		{
			id: 'plugBore',
			op: 'cylinder',
			r: '$diameter / 2 - 2 * $wall - $clearance',
			h: '$lidDepth',
			center: false,
			segments: 96,
			at: [0, 0, '-$lidDepth'],
		},
		{ id: 'lidSolid', op: 'union', of: ['cap', 'plug'] },
		{
			id: 'lid',
			op: 'subtract',
			from: 'lidSolid',
			remove: ['plugBore'],
			at: [0, 0, '$height + 15'],
			material: 'accent',
		},
	],
	output: ['body', 'lid'],
};

export const EXAMPLE_MODELS: readonly ExampleModel[] = [
	{
		id: 'primitives',
		workload: 'primitive',
		model: {
			version: 1,
			name: 'Primitives and transforms',
			units: 'mm',
			parameters: { size: 20 },
			operations: [
				{ id: 'cube', op: 'box', size: ['$size', '$size', '$size'], rotate: [0, 0, 20], material: 'metal' },
				{ id: 'ball', op: 'sphere', r: '$size / 2', segments: 48, at: ['$size * 1.5', 0, 0], material: 'ceramic' },
				{
					id: 'cone',
					op: 'cylinder',
					r: '$size / 2',
					r2: 0,
					h: '$size',
					segments: 48,
					at: ['-$size * 1.5', 0, 0],
					material: 'accent',
				},
				{
					id: 'ring',
					op: 'torus',
					R: '$size / 2',
					r: '$size / 8',
					segments: 64,
					at: [0, '$size * 1.5', 0],
					rotate: [60, 0, 0],
					material: 'rubber',
				},
			],
			output: ['cube', 'ball', 'cone', 'ring'],
		},
	},
	{
		id: 'bracket',
		workload: 'mechanical',
		model: {
			version: 1,
			name: 'L-bracket with gusset',
			units: 'mm',
			parameters: { width: 40, length: 60, height: 50, thickness: 6, hole: 6.5 },
			operations: [
				{ id: 'foot', op: 'box', size: ['$length', '$width', '$thickness'], center: false },
				{ id: 'wall', op: 'box', size: ['$thickness', '$width', '$height'], center: false },
				{
					id: 'gussetA',
					op: 'box',
					size: [1, 4, 1],
					center: false,
					at: ['$thickness', '$width / 2 - 2', '$thickness'],
				},
				{
					id: 'gussetB',
					op: 'box',
					size: ['$length * 0.6', 4, 1],
					center: false,
					at: ['$thickness', '$width / 2 - 2', '$thickness'],
				},
				{
					id: 'gussetC',
					op: 'box',
					size: [1, 4, '$height * 0.6'],
					center: false,
					at: ['$thickness', '$width / 2 - 2', '$thickness'],
				},
				{ id: 'gusset', op: 'hull', of: ['gussetA', 'gussetB', 'gussetC'] },
				{
					id: 'footHole',
					op: 'cylinder',
					r: '$hole / 2',
					h: '$thickness * 3',
					segments: 32,
					at: ['$length * 0.7', '$width / 4', 0],
				},
				{ id: 'footHoles', op: 'pattern.linear', of: 'footHole', count: 2, step: [0, '$width / 2', 0] },
				{
					id: 'wallHole',
					op: 'cylinder',
					r: '$hole / 2',
					h: '$thickness * 3',
					segments: 32,
					rotate: [0, 90, 0],
					at: [0, '$width / 2', '$height * 0.75'],
				},
				{ id: 'solid', op: 'union', of: ['foot', 'wall', 'gusset'] },
				{ id: 'bracket', op: 'subtract', from: 'solid', remove: ['footHoles', 'wallHole'], material: 'metal' },
			],
			output: 'bracket',
		},
	},
	{
		id: 'perforated',
		workload: 'repeated',
		model: {
			version: 1,
			name: 'Perforated panel',
			units: 'mm',
			parameters: { columns: 12, rows: 8, pitch: 10, hole: 3.5, thickness: 3 },
			operations: [
				{
					id: 'panel',
					op: 'extrude',
					profile: { shape: 'rect', size: ['$columns * $pitch + 10', '$rows * $pitch + 10'], round: 4 },
					h: '$thickness',
				},
				{
					id: 'hole',
					op: 'cylinder',
					r: '$hole / 2',
					h: '$thickness * 3',
					segments: 24,
					at: ['-($columns - 1) * $pitch / 2', '-($rows - 1) * $pitch / 2', 0],
				},
				{ id: 'row', op: 'pattern.linear', of: 'hole', count: '$columns', step: ['$pitch', 0, 0] },
				{ id: 'grid', op: 'pattern.linear', of: 'row', count: '$rows', step: [0, '$pitch', 0] },
				{ id: 'perforated', op: 'subtract', from: 'panel', remove: ['grid'], material: 'metal' },
			],
			output: 'perforated',
		},
	},
	{
		id: 'organic',
		workload: 'organic',
		model: {
			version: 1,
			name: 'Organic blend on a wave terrain',
			units: 'mm',
			parameters: { amplitude: 3, blend: 6 },
			operations: [
				{
					id: 'terrain',
					op: 'heightfield',
					size: [80, 80],
					z: '$amplitude * sin(x / 7) * cos(y / 9)',
					base: 6,
					resolution: 48,
					material: 'wood',
				},
				{
					id: 'creature',
					op: 'blend',
					spheres: [
						[0, 0, 14, 9],
						[10, 2, 22, 6],
						[-9, -3, 21, 6],
						[3, 10, 26, 5],
						[0, -2, 34, 7],
					],
					k: '$blend',
					resolution: 56,
					material: 'ceramic',
				},
				{
					id: 'column',
					op: 'extrude',
					profile: {
						shape: 'polygon',
						points: [
							[6, 0],
							[2, 2],
							[0, 6],
							[-2, 2],
							[-6, 0],
							[-2, -2],
							[0, -6],
							[2, -2],
						],
					},
					h: 30,
					twist: 135,
					scaleTop: 0.4,
					divisions: 24,
					at: [26, 22, 0],
					material: 'accent',
				},
			],
			output: ['terrain', 'creature', 'column'],
		},
	},
	{ id: 'enclosure', workload: 'assembly', model: enclosure },
	{
		id: 'lamp',
		workload: 'complex',
		model: {
			version: 1,
			name: 'Perforated lamp shade on a twisted stand',
			units: 'mm',
			parameters: { radius: 45, height: 90, wall: 2.5, slots: 18 },
			operations: [
				{
					id: 'shell',
					op: 'revolve',
					profile: {
						shape: 'polygon',
						points: [
							[20, 0],
							['$radius', 25],
							['$radius - 6', '$height'],
							['$radius - 6 - $wall', '$height'],
							['$radius - $wall', 25],
							['20 - $wall', 0],
						],
					},
					segments: 96,
				},
				{ id: 'slot', op: 'box', size: [30, 4, 40], at: ['$radius', 0, 45] },
				{ id: 'slots', op: 'pattern.radial', of: 'slot', count: '$slots' },
				{ id: 'shade', op: 'subtract', from: 'shell', remove: ['slots'] },
				{ id: 'soft', op: 'smooth', of: 'shade', refine: 2, sharpAngle: 50, at: [0, 0, 60], material: 'ceramic' },
				{
					id: 'stem',
					op: 'extrude',
					profile: { shape: 'rect', size: [10, 10], round: 2 },
					h: 60,
					twist: 180,
					divisions: 32,
				},
				{ id: 'foot', op: 'cylinder', r: 35, r2: 28, h: 8, segments: 96, center: false },
				{ id: 'stand', op: 'union', of: ['stem', 'foot'], material: 'metal' },
			],
			output: ['soft', 'stand'],
		},
	},
];

export const exampleModel = (id: ExampleModelId): ExampleModel =>
	EXAMPLE_MODELS.find((example) => example.id === id) as ExampleModel;
