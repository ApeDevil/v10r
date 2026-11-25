/**
 * Adversarial generative surfaces — what a confused or manipulated model could emit, and the
 * outcome each must have. `refuse` means the surface policy or the catalog validator rejects
 * the whole batch before it renders; `inert` means it is accepted because the renderer shows
 * it as plain text, so the hostile-looking string can do nothing (text is never HTML).
 *
 * Built with `JSON.parse` where a key must survive as an own property: an object literal's
 * `__proto__` sets the prototype instead of creating the key a hostile payload would carry.
 */
import { GENERATIVE_UI_CATALOG_ID as CATALOG } from '../catalog.ts';
import { GENERATIVE_SURFACE_LIMITS as LIMITS } from '../limits.ts';

export interface AdversarialSurface {
	id: string;
	/** What the payload tries. */
	threat: string;
	expect: 'refuse' | 'inert';
	/** The refusal code the surface policy reports, when the policy is the door that stops it. */
	refusal?: string;
	messages: unknown[];
}

const create = (surfaceId = 'probe', extra: Record<string, unknown> = {}) => ({
	version: '1.0',
	createSurface: { surfaceId, catalogId: CATALOG, ...extra },
});
const update = (components: unknown[], surfaceId = 'probe') => ({
	version: '1.0',
	updateComponents: { surfaceId, components },
});
const column = (children: string[]) => ({ id: 'root', component: 'Column', children });

/**
 * A "diamond" DAG: `levels` rows of two Columns, each referencing both Columns of the next
 * row, over one Text. No cycle and only `2 × levels + 2` components, but the renderer builds
 * one node per reference — about 2^(levels + 2) nodes.
 */
export function diamondComponents(levels: number): unknown[] {
	const row = (level: number) => (level === levels ? ['leaf'] : [`a${level}`, `b${level}`]);
	return [
		{ id: 'root', component: 'Column', children: row(0) },
		...Array.from({ length: levels }, (_, level) =>
			['a', 'b'].map((side) => ({ id: `${side}${level}`, component: 'Column', children: row(level + 1) })),
		).flat(),
		{ id: 'leaf', component: 'Text', text: 'shared' },
	];
}

/**
 * A complete layered DAG: `levels` rows of `width` Columns, each referencing every Column of
 * the next row — the widest fan-out the component and child limits allow, width^levels paths.
 */
export function layeredComponents(levels: number, width: number): unknown[] {
	const row = (level: number) =>
		level === levels ? ['leaf'] : Array.from({ length: width }, (_, i) => `l${level}_${i}`);
	return [
		{ id: 'root', component: 'Column', children: row(0) },
		...Array.from({ length: levels }, (_, level) =>
			Array.from({ length: width }, (_, i) => ({ id: `l${level}_${i}`, component: 'Row', children: row(level + 1) })),
		).flat(),
		{ id: 'leaf', component: 'Badge', text: 'x' },
	];
}

export const ADVERSARIAL_SURFACES: readonly AdversarialSurface[] = [
	{
		id: 'unknown-component',
		threat: 'A component outside the catalog (an embed that could load a URL).',
		expect: 'refuse',
		refusal: 'unknown_component',
		messages: [create(), update([column(['frame']), { id: 'frame', component: 'IFrame', src: 'https://example.com' }])],
	},
	{
		id: 'unknown-property',
		threat: 'A catalog component with a property the catalog does not define (an event handler).',
		expect: 'refuse',
		messages: [create(), update([column(['t']), { id: 't', component: 'Text', text: 'Hi', onClick: 'steal()' }])],
	},
	{
		id: 'script-like-text',
		threat: 'Markup and script in text, hoping the renderer interprets it.',
		expect: 'inert',
		messages: [
			create(),
			update([
				column(['a', 'b', 'c']),
				{ id: 'a', component: 'Text', text: '<script>alert(document.cookie)</script>' },
				{ id: 'b', component: 'Heading', text: '<img src=x onerror=alert(1)>' },
				{ id: 'c', component: 'Text', text: '**bold** [link](https://example.com)' },
			]),
		],
	},
	{
		id: 'javascript-url',
		threat: 'A javascript: URL in a string, obfuscated with a tab.',
		expect: 'refuse',
		refusal: 'unsafe_url',
		messages: [create(), update([column(['t']), { id: 't', component: 'Text', text: 'java\tscript:alert(1)' }])],
	},
	{
		id: 'data-url-in-context',
		threat: 'A data: URL smuggled through an action context back to the agent.',
		expect: 'refuse',
		refusal: 'unsafe_url',
		messages: [
			create(),
			update([
				column(['b']),
				{
					id: 'b',
					component: 'Button',
					label: 'Open',
					action: { event: { name: 'open', context: { href: 'data:text/html;base64,PHNjcmlwdD4=' } } },
				},
			]),
		],
	},
	{
		id: 'oversized-string',
		threat: 'A label long enough to carry a document.',
		expect: 'refuse',
		refusal: 'string_too_long',
		messages: [
			create(),
			update([column(['t']), { id: 't', component: 'Text', text: 'x'.repeat(LIMITS.maxStringLength + 1) }]),
		],
	},
	{
		id: 'too-many-components',
		threat: 'A flood of components.',
		expect: 'refuse',
		refusal: 'too_many_components',
		messages: [
			create(),
			update([
				{ id: 'root', component: 'Column', children: Array.from({ length: 30 }, (_, i) => `g${i}`) },
				...Array.from({ length: 30 }, (_, g) => ({
					id: `g${g}`,
					component: 'Row',
					children: Array.from({ length: 4 }, (_, i) => `t${g}_${i}`),
				})),
				...Array.from({ length: 120 }, (_, i) => ({
					id: `t${Math.floor(i / 4)}_${i % 4}`,
					component: 'Badge',
					text: String(i),
				})),
			]),
		],
	},
	{
		id: 'deep-nesting',
		threat: 'A chain of columns deep enough to exhaust a recursive renderer.',
		expect: 'refuse',
		refusal: 'too_deep',
		messages: [
			create(),
			update(
				Array.from({ length: LIMITS.maxDepth + 3 }, (_, i) => ({
					id: i === 0 ? 'root' : `c${i}`,
					component: 'Column',
					children: [`c${i + 1}`],
				})).concat([{ id: `c${LIMITS.maxDepth + 3}`, component: 'Text', text: 'bottom' } as never]),
			),
		],
	},
	{
		id: 'shared-diamond',
		threat: 'Components that share children, so 22 definitions expand to thousands of rendered nodes.',
		expect: 'refuse',
		refusal: 'too_many_rendered_nodes',
		messages: [create(), update(diamondComponents(LIMITS.maxDepth - 1))],
	},
	{
		id: 'repeated-children',
		threat: 'One container listing the same child forty times, twice over: 3 definitions, 1,641 nodes.',
		expect: 'refuse',
		refusal: 'too_many_rendered_nodes',
		messages: [
			create(),
			update([
				column(Array.from({ length: LIMITS.maxChildren }, () => 'row')),
				{ id: 'row', component: 'Row', children: Array.from({ length: LIMITS.maxChildren }, () => 'cell') },
				{ id: 'cell', component: 'Badge', text: 'x' },
			]),
		],
	},
	{
		id: 'amplifying-rewire',
		threat: 'A valid tree, then an update that rewires its containers to share one subtree.',
		expect: 'refuse',
		refusal: 'too_many_rendered_nodes',
		messages: [
			create(),
			update([
				column(['a', 'b']),
				{ id: 'a', component: 'Row', children: [] },
				{ id: 'b', component: 'Text', text: 'b' },
			]),
			update([
				column(Array.from({ length: LIMITS.maxChildren }, () => 'a')),
				{ id: 'a', component: 'Row', children: Array.from({ length: 8 }, () => 'b') },
			]),
		],
	},
	{
		id: 'disconnected-cycle',
		threat: 'A cycle among components root never reaches, waiting for one update to attach it.',
		expect: 'refuse',
		refusal: 'cyclic_reference',
		messages: [
			create(),
			update([
				column(['t']),
				{ id: 't', component: 'Text', text: 'hi' },
				{ id: 'x', component: 'Card', child: 'y' },
				{ id: 'y', component: 'Card', child: 'x' },
			]),
		],
	},
	{
		id: 'cyclic-children',
		threat: 'Two components that contain each other.',
		expect: 'refuse',
		refusal: 'cyclic_reference',
		messages: [
			create(),
			update([column(['a']), { id: 'a', component: 'Card', child: 'b' }, { id: 'b', component: 'Card', child: 'a' }]),
		],
	},
	{
		id: 'missing-root',
		threat: 'Components with no root, so nothing anchors the tree.',
		expect: 'refuse',
		refusal: 'missing_root',
		messages: [create(), update([{ id: 'main', component: 'Text', text: 'orphan' }])],
	},
	{
		id: 'binding-traversal',
		threat: 'A binding path that climbs out of the surface data model.',
		expect: 'refuse',
		refusal: 'bad_binding_path',
		messages: [
			create(),
			update([
				column(['f']),
				{ id: 'f', component: 'TextField', label: 'Name', value: { '@path': '../../session/token' } },
			]),
		],
	},
	{
		id: 'prototype-key',
		threat: 'A __proto__ key in the data model, aiming at prototype pollution.',
		expect: 'refuse',
		refusal: 'bad_binding_path',
		messages: [
			create('probe', { dataModel: JSON.parse('{"__proto__": {"isAdmin": true}}') }),
			update([column(['t']), { id: 't', component: 'Text', text: 'hi' }]),
		],
	},
	{
		id: 'foreign-surface',
		threat: 'An update addressed to another surface on the same page.',
		expect: 'refuse',
		refusal: 'foreign_surface',
		messages: [
			create(),
			update([column(['t']), { id: 't', component: 'Text', text: 'hi' }]),
			{ version: '1.0', updateDataModel: { surfaceId: 'checkout', path: '/total', value: 0 } },
		],
	},
	{
		id: 'function-call',
		threat: 'A catalog function call (openUrl) that would navigate the page.',
		expect: 'refuse',
		refusal: 'function_call',
		messages: [
			create(),
			update([
				column(['b']),
				{
					id: 'b',
					component: 'Button',
					label: 'Go',
					action: { functionCall: { '@call': 'openUrl', args: { url: 'https://example.com' } } },
				},
			]),
		],
	},
	{
		id: 'oversized-data-model',
		threat: 'A data model large enough to exhaust memory or the action context.',
		expect: 'refuse',
		refusal: 'data_model_too_large',
		messages: [
			create('probe', {
				dataModel: { rows: Array.from({ length: 40 }, () => 'y'.repeat(LIMITS.maxStringLength - 100)) },
			}),
			update([column(['t']), { id: 't', component: 'Text', text: 'hi' }]),
		],
	},
	{
		id: 'foreign-catalog',
		threat: 'A surface that names another catalog, to reach components v10r never approved.',
		expect: 'refuse',
		refusal: 'unknown_catalog',
		messages: [
			{
				version: '1.0',
				createSurface: {
					surfaceId: 'probe',
					catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
				},
			},
			update([column(['t']), { id: 't', component: 'Text', text: 'hi' }]),
		],
	},
];
