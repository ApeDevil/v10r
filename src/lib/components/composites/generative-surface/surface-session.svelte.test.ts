import { type ComponentNode, getValue, MessageProcessor } from '@a2ui/web_core';
import { describe, expect, it, vi } from 'vitest';
import { diamondComponents } from '#lib/generative-ui/fixtures/adversarial.ts';
import { ADVERSARIAL_SURFACES, GENERATIVE_SURFACE_SCENARIOS } from '#lib/generative-ui/fixtures/index.ts';
import { GENERATIVE_UI_CATALOG_ID as CATALOG, type GenerativeSurfaceAction } from '#lib/generative-ui/index.ts';
import { loadGenerativeUiCatalog } from '#lib/generative-ui/load-catalog.ts';
import { setterOf } from './node-props.ts';
import { createGenerativeSurfaceSession } from './surface-session.svelte.ts';

const scenario = (id: string) => {
	const found = GENERATIVE_SURFACE_SCENARIOS.find((s) => s.id === id);
	if (!found) throw new Error(`no scenario ${id}`);
	return found;
};

/** Depth-first search of the resolved tree for the node with this component id. */
function find(node: ComponentNode | undefined, componentId: string): ComponentNode | undefined {
	if (!node) return undefined;
	if (node.componentId === componentId) return node;
	for (const value of Object.values(getValue(node.props) as Record<string, unknown>)) {
		const children = Array.isArray(value) ? value : [value];
		for (const child of children) {
			if (child && typeof child === 'object' && 'componentId' in child) {
				const hit = find(child as ComponentNode, componentId);
				if (hit) return hit;
			}
		}
	}
	return undefined;
}

const props = (node: ComponentNode | undefined) => (node ? (getValue(node.props) as Record<string, unknown>) : {});

function press(session: ReturnType<typeof createGenerativeSurfaceSession>, buttonId: string) {
	const action = props(find(session.root, buttonId)).action as () => Promise<void>;
	return action();
}

describe('generative surface session', () => {
	it('renders a scenario into a resolved tree of catalog components', () => {
		const session = createGenerativeSurfaceSession();
		expect(session.apply(scenario('requirements-form').messages)).toBe(true);
		expect(session.root?.type).toBe('Card');
		expect(find(session.root, 'name')?.type).toBe('TextField');
		expect(find(session.root, 'deployment')?.state).toBe('resolved');
		expect(session.batches).toBe(1);
	});

	it('binds an input two ways: an edit writes the data model and the action carries it', async () => {
		const actions: GenerativeSurfaceAction[] = [];
		const session = createGenerativeSurfaceSession({ onaction: (a) => actions.push(a) });
		session.apply(scenario('requirements-form').messages);

		setterOf<string>(props(find(session.root, 'name')).value)('Atlas');
		setterOf<string[]>(props(find(session.root, 'deployment')).value)(['edge']);
		setterOf<number>(props(find(session.root, 'users')).value)(250);
		expect(session.read('/requirements/name')).toBe('Atlas');
		expect(textValue(find(session.root, 'name'))).toBe('Atlas');

		await press(session, 'submit');
		expect(actions).toEqual([
			{
				surfaceId: 'requirements',
				name: 'collect_requirements',
				sourceComponentId: 'submit',
				context: { requirements: { name: 'Atlas', summary: '', deployment: ['edge'], auth: true, users: 250 } },
			},
		]);
	});

	it('emits an action without a context, and never mutates the fixture', async () => {
		const onaction = vi.fn();
		const fixture = scenario('architecture-selection');
		const snapshot = structuredClone(fixture.messages);
		const session = createGenerativeSurfaceSession({ onaction });
		session.apply(fixture.messages);
		setterOf<string[]>(props(find(session.root, 'choice')).value)(['services']);
		await press(session, 'explain');
		expect(onaction).toHaveBeenCalledWith({
			surfaceId: 'architecture',
			name: 'explain_tradeoffs',
			sourceComponentId: 'explain',
			context: {},
		});
		expect(fixture.messages).toEqual(snapshot);
	});

	it('applies a follow-up batch to the rendered surface incrementally', () => {
		const fixture = scenario('dynamic-update');
		const session = createGenerativeSurfaceSession();
		session.apply(fixture.messages);
		const statusNode = find(session.root, 'status');
		expect(textValue(statusNode)).toBe('Estimating…');
		expect(find(session.root, 'breakdown')).toBeUndefined();

		expect(session.apply(fixture.followUp?.messages)).toBe(true);
		expect(session.batches).toBe(2);
		expect(find(session.root, 'breakdown')?.type).toBe('Table');
		expect(find(session.root, 'badge')?.type).toBe('Badge');
		// The untouched node is the same instance with a new value: an update, not a re-render.
		expect(find(session.root, 'status')).toBe(statusNode);
		expect(textValue(statusNode)).toBe('About $70 per month.');
	});

	it('consumes a stream, showing a placeholder until a referenced child arrives', async () => {
		const [create, update] = scenario('technology-comparison').messages as [
			unknown,
			{ updateComponents: { components: unknown[] } },
		];
		const components = update.updateComponents.components;
		const chunk = (list: unknown[]) => ({
			version: '1.0',
			updateComponents: { surfaceId: 'comparison', components: list },
		});
		const session = createGenerativeSurfaceSession();
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		async function* stream() {
			yield create;
			yield chunk(components.slice(0, 1));
			await gate;
			yield chunk(components.slice(1));
		}
		const done = session.consume(stream());
		await vi.waitFor(() => expect(session.batches).toBe(2));
		expect(session.streaming).toBe(true);
		expect(find(session.root, 'table')?.isPlaceholder).toBe(true);
		release();
		await done;
		expect(session.streaming).toBe(false);
		expect(find(session.root, 'table')?.type).toBe('Table');
	});

	it('refuses an adversarial batch, keeps the surface as it was and reports why', () => {
		const onrefusal = vi.fn();
		const session = createGenerativeSurfaceSession({ onrefusal });
		session.apply(scenario('technology-comparison').messages);
		const update = (components: unknown[]) => ({
			version: '1.0',
			updateComponents: { surfaceId: 'comparison', components },
		});
		expect(session.apply(update([{ id: 'note', component: 'IFrame', src: 'javascript:alert(1)' }]))).toBe(false);
		expect(session.refusals.map((r) => r.code)).toContain('unknown_component');
		expect(onrefusal).toHaveBeenCalledOnce();
		expect(find(session.root, 'note')?.type).toBe('Text');
		expect(session.batches).toBe(1);
	});

	it('refuses every adversarial fixture except the inert ones, which it renders', () => {
		for (const fixture of ADVERSARIAL_SURFACES) {
			const session = createGenerativeSurfaceSession();
			const applied = session.apply(fixture.messages);
			if (fixture.id === 'missing-root') {
				// A stream may deliver root later, so the renderer accepts the batch — and shows
				// nothing until a root exists. Only the server's complete compile refuses it.
				expect(session.root, fixture.id).toBeUndefined();
			} else {
				expect(applied, fixture.id).toBe(fixture.expect === 'inert');
			}
			session.dispose();
		}
	});

	it('falls back for a component the resolver cannot render', () => {
		const session = createGenerativeSurfaceSession();
		// A cycle that arrives in two batches — the policy refuses the second, so the renderer
		// only ever holds the acyclic part.
		session.apply([
			{
				version: '1.0',
				createSurface: { surfaceId: 's', catalogId: 'https://v10r.dev/a2ui/catalogs/v10r/v1/catalog.json' },
			},
			{
				version: '1.0',
				updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Card', child: 'a' }] },
			},
		]);
		expect(session.root?.type).toBe('Card');
		expect(find(session.root, 'a')?.isPlaceholder).toBe(true);
	});
});

/** Every node of the resolved tree, one per reference — what the Svelte renderer mounts. */
function countNodes(node: ComponentNode | undefined): number {
	if (!node) return 0;
	let count = 1;
	for (const value of Object.values(getValue(node.props) as Record<string, unknown>)) {
		for (const child of Array.isArray(value) ? value : [value]) {
			if (child && typeof child === 'object' && 'componentId' in child) count += countNodes(child as ComponentNode);
		}
	}
	return count;
}

const message = (kind: string, body: Record<string, unknown>, surfaceId = 'requirements') => ({
	version: '1.0',
	[kind]: { surfaceId, ...body },
});
const createFor = (surfaceId: string, extra: Record<string, unknown> = {}) =>
	message('createSurface', { catalogId: CATALOG, ...extra }, surfaceId);
/** A component the catalog schema rejects (unknown property) — the policy cannot see it. */
const schemaViolation = { id: 'intro', component: 'Text', text: 'hi', onClick: 'steal()' };

/** The requirements form with one user edit: the project name typed as "Atlas". */
function requirements() {
	const session = createGenerativeSurfaceSession();
	session.apply(scenario('requirements-form').messages);
	setterOf<string>(props(find(session.root, 'name')).value)('Atlas');
	return session;
}

describe('web_core message processing (why the session rebuilds on error)', () => {
	it('applies a batch partially: keeps messages before a failure and still applies those after it', () => {
		const processor = new MessageProcessor([loadGenerativeUiCatalog()]);
		const errors = processor.processMessagesWithErrors([
			createFor('s', { dataModel: { a: 'x' } }),
			message('updateComponents', { components: [{ id: 'root', component: 'Text', text: 'one' }] }, 's'),
			message('updateDataModel', { path: '/a/b', value: 1 }, 's'),
			message('updateDataModel', { path: '/c', value: 2 }, 's'),
		] as never[]);
		expect(errors).toHaveLength(1);
		const surface = processor.getSurface('s');
		expect(surface?.componentsModel.get('root')).toBeDefined();
		expect(surface?.dataModel.get('/')).toEqual({ a: 'x', c: 2 });
	});

	it('leaves a surface created, without components, when createSurface carries a bad one', () => {
		const processor = new MessageProcessor([loadGenerativeUiCatalog()]);
		const errors = processor.processMessagesWithErrors([
			createFor('s', { dataModel: { a: 'x' }, components: [{ ...schemaViolation, id: 'root' }] }),
		] as never[]);
		expect(errors).toHaveLength(1);
		expect(processor.getSurface('s')?.dataModel.get('/')).toEqual({ a: 'x' });
		expect(processor.getSurface('s')?.componentsModel.get('root')).toBeUndefined();
	});
});

describe('generative surface session — atomic batches', () => {
	it('rolls back a batch web_core half-applies: components, data model and user edits as before', () => {
		const session = requirements();
		const before = structuredClone(session.read('/'));
		const refused = session.apply([
			message('updateDataModel', { path: '/requirements/summary', value: 'overwritten' }),
			message('updateComponents', {
				components: [
					{ id: 'form', component: 'Column', children: ['intro', 'name', 'extra'] },
					{ id: 'extra', component: 'Text', text: 'half-applied' },
				],
			}),
			message('updateComponents', { components: [schemaViolation] }),
			message('updateDataModel', { path: '/after', value: 'applied after the failure' }),
		]);
		expect(refused).toBe(false);
		expect(session.refusals.map((r) => r.code)).toEqual(['catalog_violation']);
		expect(session.read('/')).toEqual(before);
		expect(session.read('/requirements/name')).toBe('Atlas');
		expect(find(session.root, 'extra')).toBeUndefined();
		expect(find(session.root, 'submit')?.type).toBe('Button');
		expect(session.batches).toBe(1);
	});

	it('rolls back a data model write web_core refuses (a path through a string)', () => {
		const session = requirements();
		const before = structuredClone(session.read('/'));
		expect(
			session.apply([
				message('updateDataModel', { path: '/requirements/users', value: 9 }),
				message('updateDataModel', { path: '/requirements/name/first', value: 'x' }),
			]),
		).toBe(false);
		expect(session.read('/')).toEqual(before);
	});

	it('keeps the previous interface usable after a refusal: inputs bind and actions fire', async () => {
		const onaction = vi.fn();
		const session = createGenerativeSurfaceSession({ onaction });
		session.apply(scenario('requirements-form').messages);
		session.apply(message('updateComponents', { components: [schemaViolation] }));
		setterOf<string>(props(find(session.root, 'name')).value)('Borealis');
		expect(textValue(find(session.root, 'name'))).toBe('Borealis');
		await press(session, 'submit');
		expect(onaction).toHaveBeenCalledWith(
			expect.objectContaining({ context: { requirements: expect.objectContaining({ name: 'Borealis' }) } }),
		);
	});

	it('keeps validation and renderer state consistent: the refused batch defined nothing', () => {
		const session = requirements();
		session.apply([
			message('updateComponents', { components: [{ id: 'extra', component: 'Text', text: 'x' }] }),
			message('updateComponents', { components: [schemaViolation] }),
		]);
		// Had web_core kept `extra`, the form would render it; it renders a placeholder instead.
		expect(
			session.apply(
				message('updateComponents', { components: [{ id: 'form', component: 'Column', children: ['name', 'extra'] }] }),
			),
		).toBe(true);
		expect(find(session.root, 'extra')?.isPlaceholder).toBe(true);
		expect(session.read('/requirements/name')).toBe('Atlas');
	});

	it('takes a valid update after a refusal, preserving user edits outside the paths it writes', () => {
		const session = requirements();
		session.apply(message('updateComponents', { components: [schemaViolation] }));
		expect(
			session.apply([
				message('updateComponents', {
					components: [{ id: 'intro', component: 'Text', text: 'Almost done.', variant: 'caption' }],
				}),
				message('updateDataModel', { path: '/requirements/users', value: 500 }),
			]),
		).toBe(true);
		expect(session.refusals).toEqual([]);
		expect(textValue(find(session.root, 'intro'))).toBe('Almost done.');
		expect(session.read('/requirements/name')).toBe('Atlas');
		expect(session.read('/requirements/users')).toBe(500);
		expect(session.batches).toBe(2);
	});

	it('recovers from a refused createSurface: no half-created surface blocks the next one', () => {
		const session = createGenerativeSurfaceSession();
		const broken = createFor('s', { dataModel: { a: 1 }, components: [{ ...schemaViolation, id: 'root' }] });
		expect(session.apply(broken)).toBe(false);
		expect(session.surfaceId).toBeNull();
		expect(session.read('/')).toBeUndefined();
		expect(session.apply(createFor('s', { components: [{ id: 'root', component: 'Text', text: 'second try' }] }))).toBe(
			true,
		);
		expect(textValue(session.root)).toBe('second try');
	});

	it('refuses an amplifying update quickly and keeps the rendered tree', () => {
		const session = createGenerativeSurfaceSession();
		session.apply([
			createFor('probe'),
			message('updateComponents', { components: [{ id: 'root', component: 'Text', text: 'kept' }] }, 'probe'),
		]);
		const started = performance.now();
		const applied = session.apply(message('updateComponents', { components: diamondComponents(30) }, 'probe'));
		expect(performance.now() - started).toBeLessThan(50);
		expect(applied).toBe(false);
		expect(session.refusals.map((r) => r.code)).toContain('too_many_rendered_nodes');
		expect(textValue(session.root)).toBe('kept');
	});

	it('renders one node per reference, exactly as the policy counts them', () => {
		const session = createGenerativeSurfaceSession();
		const root = { id: 'root', component: 'Column', children: [...Array.from({ length: 34 }, () => 'row'), 'rule'] };
		const row = { id: 'row', component: 'Row', children: Array.from({ length: 6 }, () => 'rule') };
		expect(
			session.apply([
				createFor('probe'),
				message('updateComponents', { components: [root, row, { id: 'rule', component: 'Divider' }] }, 'probe'),
			]),
		).toBe(true);
		expect(countNodes(session.root)).toBe(240);
	});
});

describe('generative surface session — delete, recreate, restore', () => {
	it('deletes a surface, then recreates it under the same id with new content', () => {
		const session = createGenerativeSurfaceSession();
		session.apply(scenario('requirements-form').messages);
		expect(session.apply(message('deleteSurface', {}))).toBe(true);
		expect(session.root).toBeUndefined();
		expect(session.surfaceId).toBeNull();
		expect(session.snapshot()).toEqual([]);
		expect(session.apply(createFor('requirements', { components: [{ id: 'root', component: 'Divider' }] }))).toBe(true);
		expect(session.root?.type).toBe('Divider');
		expect(session.read('/requirements')).toBeUndefined();
	});

	it('follows a delete and a recreate in one batch to the new surface model', () => {
		const session = createGenerativeSurfaceSession();
		session.apply(scenario('requirements-form').messages);
		expect(
			session.apply([
				message('deleteSurface', {}),
				createFor('requirements', { components: [{ id: 'root', component: 'Text', text: 'fresh' }] }),
			]),
		).toBe(true);
		expect(textValue(session.root)).toBe('fresh');
		expect(session.read('/requirements')).toBeUndefined();
	});

	it('restores a surface into a fresh session from its snapshot, user edits included', () => {
		const fixture = scenario('dynamic-update');
		const original = createGenerativeSurfaceSession();
		original.apply(fixture.messages);
		original.apply(fixture.followUp?.messages);
		const snapshot = original.snapshot();
		expect(snapshot).toHaveLength(1);

		const restored = createGenerativeSurfaceSession();
		expect(restored.apply(structuredClone(snapshot))).toBe(true);
		expect(restored.read('/')).toEqual(original.read('/'));
		expect(countNodes(restored.root)).toBe(countNodes(original.root));
		expect(find(restored.root, 'breakdown')?.type).toBe('Table');

		const form = requirements();
		const back = createGenerativeSurfaceSession();
		expect(back.apply(form.snapshot())).toBe(true);
		expect(back.read('/requirements/name')).toBe('Atlas');
		expect(textValue(find(back.root, 'name'))).toBe('Atlas');
	});

	it('replays a stored message log into a fresh session to the same surface and the same refusals', () => {
		const log: unknown[][] = [
			scenario('requirements-form').messages,
			[message('updateComponents', { components: [schemaViolation] })],
			[message('updateDataModel', { path: '/requirements/users', value: 120 })],
			[message('updateComponents', { components: diamondComponents(30) })],
		];
		const outcomes = (session: ReturnType<typeof createGenerativeSurfaceSession>) => log.map((b) => session.apply(b));
		const live = createGenerativeSurfaceSession();
		const replayed = createGenerativeSurfaceSession();
		expect(outcomes(live)).toEqual([true, false, true, false]);
		expect(outcomes(replayed)).toEqual([true, false, true, false]);
		expect(replayed.read('/')).toEqual(live.read('/'));
		expect(replayed.snapshot()).toEqual(live.snapshot());
	});

	it('refuses a snapshot that no longer passes the policy, like any other input', () => {
		const form = requirements();
		setterOf<string>(props(find(form.root, 'summary')).value)('x'.repeat(2000));
		const back = createGenerativeSurfaceSession();
		expect(back.apply(form.snapshot())).toBe(false);
		expect(back.refusals.map((r) => r.code)).toContain('string_too_long');
	});
});

function textValue(node: ComponentNode | undefined): unknown {
	const p = props(node);
	const binding = (p.value ?? p.text) as { value?: unknown } | undefined;
	return binding?.value;
}
