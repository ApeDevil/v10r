import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from '#lib/generative-ui/fixtures/index.ts';
import { SurfaceActionRecordSchema } from '#lib/generative-ui/index.ts';
import { admitSurfaceAction } from '../generative-ui/surface-action-door.ts';
import { historyOf, type StoredThreadMessage, scriptedSurfacePress } from './surface-press';

const fixture = (id: string) => {
	const found = [...GENERATIVE_SURFACE_SCENARIOS, ...GENERATIVE_SURFACE_CATALOG_EXAMPLES].find((s) => s.id === id);
	if (!found) throw new Error(id);
	return found;
};
const row = (id: string, toolCallId: string, surfaceId: string, messages: unknown[]): StoredThreadMessage => ({
	id,
	role: 'assistant',
	content: '',
	parts: [
		{ type: 'tool-render_surface', toolCallId, state: 'output-available', output: { ok: true, surfaceId, messages } },
	],
});
const EVENT = '00000000-0000-4000-8000-000000000001';

describe('scriptedSurfacePress', () => {
	it('presses the declared Button with its context resolved after the scripted edits', () => {
		const form = fixture('requirements-form');
		const thread = [row('a1', 'call_1', 'requirements', form.messages)];
		const press = scriptedSurfacePress(
			thread,
			{ event: 'collect_requirements', values: { '/requirements/name': 'Shop' } },
			EVENT,
		);
		expect(press).toEqual({
			action: {
				surfaceId: 'requirements',
				name: 'collect_requirements',
				sourceComponentId: 'submit',
				context: {
					requirements: { name: 'Shop', summary: '', deployment: ['cloud'], auth: true, users: 50 },
				},
			},
			renderId: 'call_1',
			eventId: EVENT,
		});
		// What the script builds is exactly what the route admits.
		expect(v.safeParse(SurfaceActionRecordSchema, press).success).toBe(true);
		expect(admitSurfaceAction(thread, press as never, 'conv').ok).toBe(true);
	});

	it('presses the latest render, after the follow-up batches (updated data model included)', () => {
		const update = fixture('dynamic-update');
		const thread = [
			row('a1', 'call_1', 'estimate', update.messages),
			row('a2', 'call_2', 'estimate', update.followUp?.messages ?? []),
		];
		expect(scriptedSurfacePress(thread, { event: 'refine_estimate' }, EVENT)).toMatchObject({
			renderId: 'call_2',
			action: { sourceComponentId: 'refine', context: { monthly: '70' } },
		});
	});

	it('finds nothing when no Button declares the event', () => {
		const thread = [row('a1', 'call_1', 'flow', fixture('request-flow').messages)];
		expect(scriptedSurfacePress(thread, {}, EVENT)).toBeNull();
		expect(scriptedSurfacePress([], { event: 'x' }, EVENT)).toBeNull();
	});
});

describe('historyOf', () => {
	it('sends stored parts back, and the text for a row without parts', () => {
		expect(historyOf([{ id: 'u1', role: 'user', content: 'hi', parts: null }, row('a1', 'call_1', 's', [])])).toEqual([
			{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
			{ id: 'a1', role: 'assistant', parts: row('a1', 'call_1', 's', []).parts },
		]);
	});
});
