/**
 * The offline evaluation of a generative-surface conversation: a scripted thread run through
 * the server's own doors — the `render_surface` tool (what the model's calls compile to), the
 * history replay (what an update is checked against) and the surface action door (what a
 * press is checked against) — over rows shaped exactly as the database persists them. No
 * model and no database: each turn's model output is a committed fixture, so every case
 * here means the same thing on every run. The live counterpart is the golden set
 * (`eval/golden-cases.json`, `bun run ai:eval`).
 */
import { describe, expect, it } from 'vitest';
import {
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from '#lib/generative-ui/fixtures/index.ts';
import type { SurfaceActionRecord } from '#lib/generative-ui/index.ts';
import { createRenderSurfaceTool } from './render-surface-tool.ts';
import { admitSurfaceAction, surfaceActionPromptsForModel } from './surface-action-door.ts';
import { replaySurfaces, surfaceGraphsFromHistory, surfaceRendersOf } from './surface-history.ts';

const CONVERSATION = 'conv-eval';
const scenario = (id: string) => {
	const found = [...GENERATIVE_SURFACE_SCENARIOS, ...GENERATIVE_SURFACE_CATALOG_EXAMPLES].find((s) => s.id === id);
	if (!found) throw new Error(`no fixture ${id}`);
	return found;
};

/** One persisted row, as `ai.message` holds it (role + parts). */
interface Row {
	role: 'user' | 'assistant';
	parts: Record<string, unknown>[];
}

/** A scripted thread: each assistant turn calls `render_surface` the way the model would. */
class Thread {
	readonly rows: Row[] = [];
	#calls = 0;

	user(text: string) {
		this.rows.push({ role: 'user', parts: [{ type: 'text', text }] });
	}

	/** One model turn: the tool is built from the persisted history, as the capability builds it. */
	async render(surfaceId: string, express: string) {
		const tool = createRenderSurfaceTool(surfaceGraphsFromHistory(this.rows));
		const toolCallId = `call_${++this.#calls}`;
		// biome-ignore lint/style/noNonNullAssertion: the tool defines execute
		const output = (await tool.execute!({ surfaceId, express } as never, {
			toolCallId,
			messages: [],
			context: {},
		})) as { ok: boolean };
		this.rows.push({
			role: 'assistant',
			parts: [{ type: 'tool-render_surface', toolCallId, state: 'output-available', input: {}, output }],
		});
		return { toolCallId, output };
	}

	/** A press through the door; admitted presses are persisted as the route persists them. */
	press(record: SurfaceActionRecord) {
		const admission = admitSurfaceAction(this.rows, record, CONVERSATION);
		if (admission.ok) this.rows.push({ role: 'user', parts: admission.turn.parts });
		return admission;
	}

	/** The conversation as `GET /api/ai/conversations/[id]` serves it back after a reload. */
	restored(): Row[] {
		return JSON.parse(JSON.stringify(this.rows));
	}
}

let events = 0;
const eventId = () => `00000000-0000-4000-8000-${String(++events).padStart(12, '0')}`;
const pressOf = (renderId: string, surfaceId: string, source: string, name: string, context = {}) => ({
	action: { surfaceId, sourceComponentId: source, name, context },
	renderId,
	eventId: eventId(),
});

describe('offline evaluation: a generative-surface conversation', () => {
	it('multiple surfaces in one thread are tracked independently', async () => {
		const thread = new Thread();
		thread.user('Scope a project and show me hosting costs.');
		await thread.render('requirements', scenario('requirements-form').express);
		await thread.render('costs', scenario('cost-explorer').express);
		const versions = replaySurfaces(surfaceRendersOf(thread.rows));
		expect([...versions.keys()]).toEqual(['requirements', 'costs']);
		expect(versions.get('requirements')?.renderId).toBe('call_1');
		expect(versions.get('costs')?.renderId).toBe('call_2');
	});

	it('form submission, follow-up update, then a follow-up interaction on the updated surface', async () => {
		const thread = new Thread();
		const step = scenario('step-form');
		const first = await thread.render('setup', step.express);
		expect(first.output.ok).toBe(true);

		const submitted = thread.press(pressOf(first.toolCallId, 'setup', 'next', 'next_step', { name: '' }));
		expect(submitted.ok).toBe(true);
		// The model reads the press as wrapped untrusted content; the row holds the data part.
		const forModel = surfaceActionPromptsForModel(thread.rows as never[]) as unknown as Row[];
		expect(JSON.stringify(forModel.at(-1))).toContain('untrusted-content source=\\"surface_action\\"');
		expect(JSON.stringify(thread.rows.at(-1))).not.toContain('untrusted-content');

		// The answer updates the same surface (validation feedback), checked as an update.
		const followUp = await thread.render('setup', step.followUp?.express ?? '');
		expect(followUp.output.ok).toBe(true);

		// The old render is superseded; the follow-up interaction goes to the new one.
		expect(thread.press(pressOf(first.toolCallId, 'setup', 'next', 'next_step', { name: 'Shop' }))).toEqual({
			ok: false,
			reason: 'stale_surface',
		});
		expect(thread.press(pressOf(followUp.toolCallId, 'setup', 'next', 'next_step', { name: 'Shop' })).ok).toBe(true);
	});

	it('duplicate submission and network retry start no second turn; changed values do', async () => {
		const thread = new Thread();
		const shown = await thread.render('requirements', scenario('requirements-form').express);
		const record = pressOf(shown.toolCallId, 'requirements', 'submit', 'collect_requirements', { n: 1 });
		expect(thread.press(record).ok).toBe(true);
		expect(thread.press(record)).toEqual({ ok: false, reason: 'duplicate_event' });
		expect(thread.press({ ...record, eventId: eventId() })).toEqual({ ok: false, reason: 'duplicate_submission' });
		expect(thread.press({ ...record, eventId: eventId(), action: { ...record.action, context: { n: 2 } } }).ok).toBe(
			true,
		);
		expect(thread.rows.filter((row) => row.role === 'user')).toHaveLength(2);
	});

	it('refused actions: a crafted event, a non-Button source, a deleted surface', async () => {
		const thread = new Thread();
		const shown = await thread.render('requirements', scenario('requirements-form').express);
		expect(thread.press(pressOf(shown.toolCallId, 'requirements', 'submit', 'delete_everything'))).toEqual({
			ok: false,
			reason: 'undeclared_event',
		});
		expect(thread.press(pressOf(shown.toolCallId, 'requirements', 'name', 'collect_requirements'))).toEqual({
			ok: false,
			reason: 'not_an_action_source',
		});
		const deleted = await thread.render('requirements', 'deleteSurface("requirements")');
		expect(deleted.output.ok).toBe(true);
		expect(thread.press(pressOf(deleted.toolCallId, 'requirements', 'submit', 'collect_requirements'))).toEqual({
			ok: false,
			reason: 'deleted_surface',
		});
	});

	it('invalid model output is refused as a result, and the corrected call recovers on the same surface', async () => {
		const thread = new Thread();
		const shown = await thread.render('costs', scenario('cost-explorer').express);
		// A chart that cannot be drawn honestly, then a component outside the catalog.
		const negative = await thread.render('costs', 'chart = Chart("Cost", ["a", "b"], [{name: "s", values: [1, -2]}])');
		expect(negative.output).toMatchObject({ ok: false, refusals: [{ code: 'bad_chart' }] });
		const unknown = await thread.render('costs', 'chart = Iframe("https://example.com")');
		expect(unknown.output.ok).toBe(false);
		// The refusals changed nothing: the surface is still the first render, and it is pressable.
		expect(replaySurfaces(surfaceRendersOf(thread.rows)).get('costs')?.renderId).toBe(shown.toolCallId);
		expect(thread.press(pressOf(shown.toolCallId, 'costs', 'recalc', 'recalculate', { users: 5000 })).ok).toBe(true);
		const corrected = await thread.render('costs', scenario('cost-explorer').followUp?.express ?? '');
		expect(corrected.output.ok).toBe(true);
		expect(replaySurfaces(surfaceRendersOf(thread.rows)).get('costs')?.renderId).toBe(corrected.toolCallId);
	});

	it('a restored conversation rebuilds the same surfaces and enforces the same presses', async () => {
		const thread = new Thread();
		const shown = await thread.render('requirements', scenario('requirements-form').express);
		const record = pressOf(shown.toolCallId, 'requirements', 'submit', 'collect_requirements', { n: 1 });
		thread.press(record);
		const restored = thread.restored();
		const live = replaySurfaces(surfaceRendersOf(thread.rows)).get('requirements');
		const again = replaySurfaces(surfaceRendersOf(restored)).get('requirements');
		expect(again?.renderId).toBe(live?.renderId);
		expect([...(again?.components.keys() ?? [])]).toEqual([...(live?.components.keys() ?? [])]);
		// A stored press re-sent after the reload is the same event; a fresh press with new values is new.
		expect(admitSurfaceAction(restored, record, CONVERSATION)).toEqual({ ok: false, reason: 'duplicate_event' });
		const fresh = { ...record, eventId: eventId(), action: { ...record.action, context: { n: 3 } } };
		expect(admitSurfaceAction(restored, fresh, CONVERSATION).ok).toBe(true);
	});
});
