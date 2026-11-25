import { describe, expect, it } from 'vitest';
import {
	GENERATIVE_UI_CATALOG_ID as CATALOG,
	GENERATIVE_UI_CATALOG,
	GENERATIVE_UI_COMPONENTS,
	GENERATIVE_UI_DOMAIN_COMPONENTS,
	GENERATIVE_UI_GENERAL_COMPONENTS,
} from './catalog.ts';
import { diamondComponents, layeredComponents } from './fixtures/adversarial.ts';
import {
	ADVERSARIAL_SURFACES,
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from './fixtures/index.ts';
import { GENERATIVE_SURFACE_LIMITS as LIMITS } from './limits.ts';
import { checkGenerativeSurfaceBatch, isSurfaceDataPath, isUnsafeUrlText } from './policy.ts';
import { toGenerativeSurfaceAction } from './surface-action.ts';

const create = { version: '1.0', createSurface: { surfaceId: 'probe', catalogId: CATALOG } };
const components = (list: unknown[]) => ({
	version: '1.0',
	updateComponents: { surfaceId: 'probe', components: list },
});
const codes = (result: ReturnType<typeof checkGenerativeSurfaceBatch>) =>
	result.ok ? [] : result.refusals.map((r) => r.code);

/** A chain root → c1 → … → c{depth}, so the deepest component sits exactly `depth` levels down. */
const chain = (depth: number) => [
	...Array.from({ length: depth }, (_, i) => ({
		id: i === 0 ? 'root' : `c${i}`,
		component: 'Column',
		children: [`c${i + 1}`],
	})),
	{ id: `c${depth}`, component: 'Text', text: 'leaf' },
];

describe('generative UI catalog', () => {
	it('defines exactly the listed components, each a closed JSON Schema', () => {
		expect(Object.keys(GENERATIVE_UI_CATALOG.components)).toEqual([...GENERATIVE_UI_COMPONENTS]);
		for (const [name, schema] of Object.entries(GENERATIVE_UI_CATALOG.components)) {
			expect(schema, name).toMatchObject({ type: 'object', additionalProperties: false });
			expect((schema as { properties: { component: unknown } }).properties.component).toEqual({ const: name });
		}
	});

	it('defines no catalog functions — nothing a surface could call', () => {
		expect(GENERATIVE_UI_CATALOG).not.toHaveProperty('functions');
	});

	it('keeps the general and the domain section apart, general first', () => {
		expect(GENERATIVE_UI_COMPONENTS).toEqual([...GENERATIVE_UI_GENERAL_COMPONENTS, ...GENERATIVE_UI_DOMAIN_COMPONENTS]);
		const general = new Set<string>(GENERATIVE_UI_GENERAL_COMPONENTS);
		expect(GENERATIVE_UI_DOMAIN_COMPONENTS.some((name) => general.has(name))).toBe(false);
	});

	it('bounds every list a new component carries in its schema', () => {
		const props = (name: string) =>
			(GENERATIVE_UI_CATALOG.components as Record<string, { properties: Record<string, { maxItems?: number }> }>)[name]
				.properties;
		expect(props('Chart').labels.maxItems).toBe(LIMITS.maxChartLabels);
		expect(props('Chart').series.maxItems).toBe(LIMITS.maxChartSeries);
		expect(props('ArchitectureFlow').nodes.maxItems).toBe(LIMITS.maxFlowNodes);
	});
});

describe('surface policy — catalog examples and the newer components', () => {
	const chart = (overrides: Record<string, unknown>) => [
		create,
		components([
			{
				id: 'root',
				component: 'Chart',
				title: 'Cost',
				labels: ['a', 'b'],
				series: [{ name: 's', values: [1, 2] }],
				...overrides,
			},
		]),
	];

	for (const example of GENERATIVE_SURFACE_CATALOG_EXAMPLES) {
		it(`${example.id}: passes the policy, and its follow-up passes as an update`, () => {
			const first = checkGenerativeSurfaceBatch(example.messages, { complete: true });
			if (!first.ok) throw new Error(JSON.stringify(first.refusals));
			if (example.followUp) {
				expect(
					checkGenerativeSurfaceBatch(example.followUp.messages, { previous: first.graph, complete: true }).ok,
				).toBe(true);
			}
		});
	}

	it('accepts a complete batch that only deletes the surface (there is no root left to require)', () => {
		const shown = checkGenerativeSurfaceBatch([create, components([{ id: 'root', component: 'Text', text: 'x' }])], {
			complete: true,
		});
		if (!shown.ok) throw new Error('should render');
		const removal = [{ version: '1.0', deleteSurface: { surfaceId: 'probe' } }];
		expect(checkGenerativeSurfaceBatch(removal, { previous: shown.graph, complete: true }).ok).toBe(true);
		// Re-created in the same batch, the new tree must be complete again.
		expect(
			codes(
				checkGenerativeSurfaceBatch([...removal, create, components([{ id: 'x', component: 'Text', text: 'y' }])], {
					previous: shown.graph,
					complete: true,
				}),
			),
		).toEqual(['missing_root']);
	});

	it('accepts a drawable chart', () => {
		expect(checkGenerativeSurfaceBatch(chart({}), { complete: true }).ok).toBe(true);
	});

	it('refuses chart data a chart from zero cannot draw honestly', () => {
		expect(codes(checkGenerativeSurfaceBatch(chart({ series: [{ name: 's', values: [1] }] })))).toEqual(['bad_chart']);
		expect(codes(checkGenerativeSurfaceBatch(chart({ series: [{ name: 's', values: [1, -2] }] })))).toEqual([
			'bad_chart',
		]);
		expect(codes(checkGenerativeSurfaceBatch(chart({ series: [{ name: 's', values: [1, Number.NaN] }] })))).toEqual([
			'bad_chart',
		]);
		expect(codes(checkGenerativeSurfaceBatch(chart({ series: [{ name: 's', values: [1, '2'] }] })))).toEqual([
			'bad_chart',
		]);
		expect(codes(checkGenerativeSurfaceBatch(chart({ series: [] })))).toEqual(['bad_chart']);
	});

	it('refuses more labels or series than the limits', () => {
		const labels = Array.from({ length: LIMITS.maxChartLabels + 1 }, (_, i) => `l${i}`);
		expect(codes(checkGenerativeSurfaceBatch(chart({ labels })))).toEqual(['bad_chart']);
		const series = Array.from({ length: LIMITS.maxChartSeries + 1 }, (_, i) => ({ name: `s${i}`, values: [1, 2] }));
		expect(codes(checkGenerativeSurfaceBatch(chart({ series })))).toEqual(['bad_chart']);
	});

	it('checks the strings of every new component like any other (no executable URLs)', () => {
		const flow = components([
			{
				id: 'root',
				component: 'ArchitectureFlow',
				title: 'Flow',
				nodes: [
					{ label: 'a', kind: 'client' },
					{ label: 'javascript:alert(1)', kind: 'server' },
				],
			},
		]);
		expect(codes(checkGenerativeSurfaceBatch([create, flow]))).toEqual(['unsafe_url']);
		expect(codes(checkGenerativeSurfaceBatch(chart({ title: 'x'.repeat(LIMITS.maxStringLength + 1) })))).toEqual([
			'string_too_long',
		]);
	});

	it('counts an Expandable child against the rendered-node budget like a Card child', () => {
		const shared = { id: 'leaf', component: 'Text', text: 'x' };
		const many = Array.from({ length: LIMITS.maxChildren }, () => 'section');
		const result = checkGenerativeSurfaceBatch(
			[
				create,
				components([
					{ id: 'root', component: 'Column', children: many },
					{ id: 'section', component: 'Expandable', title: 'More', child: 'inner' },
					{ id: 'inner', component: 'Column', children: Array.from({ length: 6 }, () => 'leaf') },
					shared,
				]),
			],
			{ complete: true },
		);
		expect(codes(result)).toEqual(['too_many_rendered_nodes']);
	});
});

describe('surface policy — limits', () => {
	it('accepts a tree exactly at the depth limit and refuses one level deeper', () => {
		expect(checkGenerativeSurfaceBatch([create, components(chain(LIMITS.maxDepth))], { complete: true }).ok).toBe(true);
		expect(
			codes(checkGenerativeSurfaceBatch([create, components(chain(LIMITS.maxDepth + 1))], { complete: true })),
		).toEqual(['too_deep']);
	});

	it('counts components across batches, not per batch', () => {
		const half = Math.floor(LIMITS.maxComponents / 2);
		const badges = (from: number, n: number) =>
			Array.from({ length: n }, (_, i) => ({ id: `b${from + i}`, component: 'Badge', text: 'x' }));
		const first = checkGenerativeSurfaceBatch([
			create,
			components([{ id: 'root', component: 'Divider' }, ...badges(0, half)]),
		]);
		if (!first.ok) throw new Error(JSON.stringify(first.refusals));
		const second = checkGenerativeSurfaceBatch([components(badges(half, half + 1))], { previous: first.graph });
		expect(codes(second)).toEqual(['too_many_components']);
	});

	it('accepts a string at the length limit and refuses one character more', () => {
		const text = (n: number) => [create, components([{ id: 'root', component: 'Text', text: 'x'.repeat(n) }])];
		expect(checkGenerativeSurfaceBatch(text(LIMITS.maxStringLength)).ok).toBe(true);
		expect(codes(checkGenerativeSurfaceBatch(text(LIMITS.maxStringLength + 1)))).toEqual(['string_too_long']);
	});

	it('bounds the data model by its latest value per path, so repeated updates do not accumulate', () => {
		const write = (value: string) => ({
			version: '1.0',
			updateDataModel: { surfaceId: 'probe', path: '/note', value },
		});
		const big = 'y'.repeat(LIMITS.maxStringLength - 10);
		let graph = checkGenerativeSurfaceBatch([
			create,
			components([{ id: 'root', component: 'Text', text: { '@path': '/note' } }]),
		]);
		for (let i = 0; i < 40; i++) {
			if (!graph.ok) break;
			graph = checkGenerativeSurfaceBatch([write(big)], { previous: graph.graph });
		}
		expect(graph.ok).toBe(true);
	});

	it('refuses more messages or bytes than one batch may carry', () => {
		expect(codes(checkGenerativeSurfaceBatch(Array.from({ length: LIMITS.maxMessages + 1 }, () => create)))).toEqual([
			'too_many_messages',
		]);
		const huge = [
			create,
			components(Array.from({ length: 80 }, (_, i) => ({ id: `t${i}`, component: 'Text', text: 'z'.repeat(900) }))),
		];
		expect(codes(checkGenerativeSurfaceBatch(huge))).toEqual(['batch_too_large']);
	});

	it('refuses a Row listing more children than the limit', () => {
		const ids = Array.from({ length: LIMITS.maxChildren + 1 }, (_, i) => `t${i}`);
		expect(
			codes(checkGenerativeSurfaceBatch([create, components([{ id: 'root', component: 'Row', children: ids }])])),
		).toContain('too_many_children');
	});
});

describe('surface policy — streaming and incremental batches', () => {
	it('lets a streaming batch reference a child that has not arrived yet, but not a complete one', () => {
		const batch = [create, components([{ id: 'root', component: 'Column', children: ['later'] }])];
		expect(checkGenerativeSurfaceBatch(batch).ok).toBe(true);
		expect(codes(checkGenerativeSurfaceBatch(batch, { complete: true }))).toEqual(['missing_child']);
	});

	it('detects a cycle that only the merged graph closes', () => {
		const first = checkGenerativeSurfaceBatch([
			create,
			components([
				{ id: 'root', component: 'Card', child: 'a' },
				{ id: 'a', component: 'Card', child: 'b' },
			]),
		]);
		if (!first.ok) throw new Error('first batch should pass');
		const second = checkGenerativeSurfaceBatch([components([{ id: 'b', component: 'Card', child: 'a' }])], {
			previous: first.graph,
		});
		expect(codes(second)).toEqual(['cyclic_reference']);
	});

	it('requires createSurface first, refuses a second one, and starts over after deleteSurface', () => {
		expect(codes(checkGenerativeSurfaceBatch([components([{ id: 'root', component: 'Divider' }])]))).toEqual([
			'surface_not_created',
		]);
		expect(codes(checkGenerativeSurfaceBatch([create, create]))).toEqual(['surface_exists']);
		const recreated = checkGenerativeSurfaceBatch([
			create,
			{ version: '1.0', deleteSurface: { surfaceId: 'probe' } },
			create,
			components([{ id: 'root', component: 'Divider' }]),
		]);
		expect(recreated.ok).toBe(true);
	});

	it('accepts every committed scenario, including its follow-up on top of the first batch', () => {
		for (const scenario of GENERATIVE_SURFACE_SCENARIOS) {
			const first = checkGenerativeSurfaceBatch(scenario.messages, { complete: true });
			expect(first.ok, scenario.id).toBe(true);
			if (first.ok && scenario.followUp) {
				expect(
					checkGenerativeSurfaceBatch(scenario.followUp.messages, { previous: first.graph, complete: true }).ok,
				).toBe(true);
			}
		}
	});

	it('refuses every adversarial fixture the policy is the door for', () => {
		for (const fixture of ADVERSARIAL_SURFACES) {
			const result = checkGenerativeSurfaceBatch(fixture.messages, { surfaceId: 'probe', complete: true });
			if (fixture.expect === 'inert') expect(result.ok, fixture.id).toBe(true);
			else if (fixture.refusal) expect(codes(result), fixture.id).toContain(fixture.refusal);
		}
	});
});

describe('surface policy — graph amplification', () => {
	const accepted = (batch: unknown[], previous?: Parameters<typeof checkGenerativeSurfaceBatch>[1]) => {
		const result = checkGenerativeSurfaceBatch(batch, previous);
		if (!result.ok) throw new Error(JSON.stringify(result.refusals));
		return result.graph;
	};
	/** root → `rows` Rows (`perRow` Dividers each, all one shared Divider) plus `extra` Dividers. */
	const fanOut = (rows: number, perRow: number, extra: number) => [
		{
			id: 'root',
			component: 'Column',
			children: [...Array.from({ length: rows }, () => 'row'), ...Array.from({ length: extra }, () => 'rule')],
		},
		{ id: 'row', component: 'Row', children: Array.from({ length: perRow }, () => 'rule') },
		{ id: 'rule', component: 'Divider' },
	];

	it('accepts a shared reference and counts it once per use, up to the rendered-node budget', () => {
		// 1 + 34 × (1 + 6) + 1 = 240 nodes from three definitions.
		expect(LIMITS.maxRenderedNodes).toBe(240);
		expect(checkGenerativeSurfaceBatch([create, components(fanOut(34, 6, 1))], { complete: true }).ok).toBe(true);
		expect(codes(checkGenerativeSurfaceBatch([create, components(fanOut(34, 6, 2))], { complete: true }))).toEqual([
			'too_many_rendered_nodes',
		]);
	});

	it('refuses duplicate references in one container that multiply past the budget', () => {
		expect(codes(checkGenerativeSurfaceBatch([create, components(fanOut(40, 40, 0))]))).toEqual([
			'too_many_rendered_nodes',
		]);
	});

	it('counts a pending child as one placeholder node', () => {
		const pending = [{ id: 'root', component: 'Column', children: Array.from({ length: 40 }, () => 'later') }];
		expect(checkGenerativeSurfaceBatch([create, components(pending)]).ok).toBe(true);
	});

	it('refuses a 30-level diamond (2^32 nodes, 62 definitions) for depth and node count', () => {
		const result = checkGenerativeSurfaceBatch([create, components(diamondComponents(30))], { complete: true });
		expect(codes(result).sort()).toEqual(['too_deep', 'too_many_rendered_nodes']);
	});

	it('refuses a diamond within the depth limit on node count alone', () => {
		expect(codes(checkGenerativeSurfaceBatch([create, components(diamondComponents(LIMITS.maxDepth - 1))]))).toEqual([
			'too_many_rendered_nodes',
		]);
	});

	it('checks adversarial DAGs in linear time', () => {
		const graphs = {
			// 62 components, 2^32 paths.
			diamond30: diamondComponents(30),
			// 110 components, every node of a row referencing all 12 of the next: 12^9 paths.
			layered: layeredComponents(LIMITS.maxDepth - 1, 12),
		};
		for (const [name, list] of Object.entries(graphs)) {
			const batch = [create, components(list)];
			checkGenerativeSurfaceBatch(batch); // warm up
			const started = performance.now();
			const result = checkGenerativeSurfaceBatch(batch, { complete: true });
			const elapsed = performance.now() - started;
			expect(codes(result), name).toContain('too_many_rendered_nodes');
			expect(elapsed, name).toBeLessThan(50);
		}
	});

	it('ignores how a disconnected subgraph would expand, and refuses the update that attaches it', () => {
		// Attached under root it sits one level lower, so it must fit the depth limit from there.
		const orphan = diamondComponents(LIMITS.maxDepth - 2).map((c) =>
			(c as { id: string }).id === 'root' ? { ...(c as object), id: 'detached' } : c,
		);
		const first = accepted([create, components([{ id: 'root', component: 'Column', children: [] }, ...orphan])]);
		expect(first.components.size).toBe(orphan.length + 1);
		const attach = components([{ id: 'root', component: 'Column', children: ['detached'] }]);
		expect(codes(checkGenerativeSurfaceBatch([attach], { previous: first }))).toEqual(['too_many_rendered_nodes']);
	});

	it('refuses a cycle among disconnected components', () => {
		const fixture = ADVERSARIAL_SURFACES.find((f) => f.id === 'disconnected-cycle');
		expect(codes(checkGenerativeSurfaceBatch(fixture?.messages))).toEqual(['cyclic_reference']);
	});

	it('refuses an amplifying update on top of a valid surface, keeps the previous graph, and takes the next valid one', () => {
		const first = accepted([create, components(fanOut(10, 4, 0))]);
		const amplify = components([{ id: 'row', component: 'Row', children: Array.from({ length: 40 }, () => 'rule') }]);
		const refused = checkGenerativeSurfaceBatch([amplify], { previous: first });
		expect(codes(refused)).toEqual(['too_many_rendered_nodes']);
		// The previous graph is immutable: the refused batch changed nothing in it.
		expect(first.components.get('row')?.children).toHaveLength(4);
		const rewired = accepted(
			[components([{ id: 'row', component: 'Row', children: Array.from({ length: 10 }, () => 'rule') }])],
			{ previous: first },
		);
		expect(rewired.components.get('row')?.children).toHaveLength(10);
		// Rewiring root away from the shared row brings the count back down, so a wider row fits.
		const unshared = accepted(
			[
				components([
					{ id: 'root', component: 'Column', children: ['row'] },
					{ id: 'row', component: 'Row', children: Array.from({ length: 40 }, () => 'rule') },
				]),
			],
			{ previous: rewired },
		);
		expect(unshared.components.get('root')?.children).toEqual(['row']);
	});

	it('starts the count over after deleteSurface, and checks the recreated surface on its own', () => {
		const first = accepted([create, components(fanOut(34, 6, 1))]);
		const recreate = (list: unknown[]) => [
			{ version: '1.0', deleteSurface: { surfaceId: 'probe' } },
			create,
			components(list),
		];
		expect(checkGenerativeSurfaceBatch(recreate(fanOut(34, 6, 1)), { previous: first }).ok).toBe(true);
		expect(codes(checkGenerativeSurfaceBatch(recreate(fanOut(40, 40, 0)), { previous: first }))).toEqual([
			'too_many_rendered_nodes',
		]);
	});
});

describe('surface policy — values', () => {
	it.each([
		['javascript:alert(1)', true],
		[' JaVaScRiPt:alert(1)', true],
		['java\nscript:alert(1)', true],
		['data:text/html;base64,AAAA', true],
		['see data:image/svg+xml,<svg/> here', true],
		['vbscript:msgbox', true],
		['Raw data: five rows', false],
		['https://example.com', false],
		['Choose a JavaScript framework: Svelte', false],
	])('isUnsafeUrlText(%j) is %s', (text, unsafe) => {
		expect(isUnsafeUrlText(text)).toBe(unsafe);
	});

	it.each([
		['/form/name', true],
		['/a/b/c/d/e/f', true],
		['/a/b/c/d/e/f/g', false],
		['form/name', false],
		['/form/../secret', false],
		['/__proto__/polluted', false],
		['/constructor', false],
		['/with space', false],
		['/', false],
	])('isSurfaceDataPath(%j) is %s', (path, ok) => {
		expect(isSurfaceDataPath(path)).toBe(ok);
	});

	it('refuses a binding path anywhere, including inside an action context', () => {
		const button = {
			id: 'root',
			component: 'Button',
			label: 'Go',
			action: { event: { name: 'go', context: { secret: { '@path': '/../../cookies' } } } },
		};
		expect(codes(checkGenerativeSurfaceBatch([create, components([button])]))).toEqual(['bad_binding_path']);
	});

	it('refuses template children, which the v10r catalog does not support', () => {
		const list = { id: 'root', component: 'Column', children: { componentId: 'item', path: '/items' } };
		expect(codes(checkGenerativeSurfaceBatch([create, components([list])]))).toEqual(['template_children']);
	});

	it('refuses a component pinned to another catalog', () => {
		const foreign = { id: 'root', component: 'Text', text: 'x', catalogId: 'https://example.com/catalog.json' };
		expect(codes(checkGenerativeSurfaceBatch([create, components([foreign])]))).toEqual(['unknown_catalog']);
	});
});

describe('generative surface action', () => {
	const raw = {
		surfaceId: 'requirements',
		name: 'collect_requirements',
		sourceComponentId: 'submit',
		timestamp: '2026-11-24T00:00:00.000Z',
		catalogId: CATALOG,
		context: { requirements: { name: 'Atlas', users: 50 } },
	};

	it('keeps the event and drops the envelope', () => {
		expect(toGenerativeSurfaceAction(raw)).toEqual({
			ok: true,
			action: {
				surfaceId: 'requirements',
				name: 'collect_requirements',
				sourceComponentId: 'submit',
				context: { requirements: { name: 'Atlas', users: 50 } },
			},
		});
	});

	it('refuses a context over the byte limit and a malformed event name', () => {
		const big = { ...raw, context: { note: 'x'.repeat(LIMITS.maxActionContextBytes) } };
		expect(toGenerativeSurfaceAction(big)).toEqual({ ok: false, reason: 'context_too_large' });
		expect(toGenerativeSurfaceAction({ ...raw, name: 'drop table;' })).toEqual({ ok: false, reason: 'malformed' });
		expect(toGenerativeSurfaceAction(null)).toEqual({ ok: false, reason: 'malformed' });
	});

	it('carries plain data only', () => {
		const reading = toGenerativeSurfaceAction({ ...raw, context: { when: new Date(0), fn: () => 1 } });
		expect(reading).toEqual({
			ok: true,
			action: expect.objectContaining({ context: { when: '1970-01-01T00:00:00.000Z' } }),
		});
	});
});
