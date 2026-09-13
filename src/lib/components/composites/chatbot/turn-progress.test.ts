import { describe, expect, it } from 'vitest';
import type { GroundingItem } from '$lib/types/turn-trace';
import {
	awaitingAnswer,
	citedCatalogSources,
	inspectTurnPath,
	type StreamedMessage,
	type TraceMetadata,
	turnProgress,
} from './turn-progress';

const assistant = (trace?: TraceMetadata): StreamedMessage => ({
	role: 'assistant',
	parts: [],
	metadata: trace ? { trace } : undefined,
});

const catalogItem = (path: string, state: GroundingItem['state'], anchor: string | null = null): GroundingItem => ({
	id: `showcase:en:${path}${anchor ?? ''}`,
	kind: 'catalog',
	title: path,
	rank: 0,
	state,
	path,
	catalog: { surface: 'showcase', anchor, breadcrumb: ['Identity'], badge: null, locale: 'en' },
});

describe('awaitingAnswer', () => {
	it('is true after the user sends and while the assistant frame holds no text', () => {
		expect(awaitingAnswer([{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }])).toBe(true);
		expect(
			awaitingAnswer([
				{ role: 'user', parts: [{ type: 'text', text: 'hi' }] },
				{ role: 'assistant', parts: [] },
			]),
		).toBe(true);
		// A tool row is not the answer — the user is still waiting for a word.
		expect(awaitingAnswer([{ role: 'assistant', parts: [{ type: 'tool-search_catalog' }] }])).toBe(true);
	});

	it('is false once the assistant has text, and with no messages at all', () => {
		expect(awaitingAnswer([{ role: 'assistant', parts: [{ type: 'text', text: 'The' }] }])).toBe(false);
		expect(awaitingAnswer([{ role: 'assistant', parts: [{ type: 'text', text: '' }] }])).toBe(true);
		expect(awaitingAnswer([])).toBe(false);
	});
});

describe('turnProgress', () => {
	it('is null before the first metadata frame, on an empty trace, and for a user message', () => {
		expect(turnProgress(undefined)).toBeNull();
		expect(turnProgress(assistant())).toBeNull();
		expect(turnProgress(assistant({}))).toBeNull();
		expect(
			turnProgress({
				role: 'user',
				parts: [],
				metadata: { trace: { activations: [{ id: 'project-docs', active: true }] } },
			}),
		).toBeNull();
	});

	it('reads retrieving once a rule has been decided, catalog while navigation grounding is out', () => {
		expect(turnProgress(assistant({ activations: [{ id: 'project-docs', active: true }] }))).toBe('retrieving');
		const navigation: TraceMetadata = {
			activations: [
				{ id: 'project-docs', active: true },
				{ id: 'navigation', active: true },
			],
		};
		expect(turnProgress(assistant(navigation))).toBe('catalog');
		expect(
			turnProgress(assistant({ ...navigation, grounding: [{ id: 'catalog', ran: true, items: [], ms: 12 }] })),
		).toBe('retrieving');
	});

	it('reads generating from the first provider attempt on, whatever the sources say', () => {
		expect(
			turnProgress(
				assistant({
					activations: [{ id: 'navigation', active: true }],
					attempts: [{ attemptIndex: 0, providerId: 'google', modelId: 'gemini', outcome: 'started' }],
				}),
			),
		).toBe('generating');
	});
});

describe('citedCatalogSources', () => {
	it('returns the cited catalog rows as chips, never included-only ones, deduped by path + anchor', () => {
		const trace: TraceMetadata = {
			grounding: [
				{
					id: 'catalog',
					ran: true,
					items: [catalogItem('/showcases/auth', 'cited'), catalogItem('/showcases/forms', 'included')],
				},
				{
					id: 'project-docs',
					ran: true,
					items: [
						catalogItem('/showcases/auth', 'cited'),
						catalogItem('/docs/blueprint/auth', 'cited', '#sessions'),
						{ id: 'chk_1', kind: 'chunk', title: 'Auth', rank: 0, state: 'cited' },
					],
				},
			],
		};
		expect(citedCatalogSources(trace).map((s) => `${s.path}${s.anchor ?? ''}`)).toEqual([
			'/showcases/auth',
			'/docs/blueprint/auth#sessions',
		]);
		expect(citedCatalogSources(null)).toEqual([]);
	});
});

describe('inspectTurnPath', () => {
	const finished: TraceMetadata = { attempts: [{ attemptIndex: 0, providerId: 'p', modelId: 'm', outcome: 'ok' }] };
	const running: TraceMetadata = { attempts: [{ attemptIndex: 0, providerId: 'p', modelId: 'm', outcome: 'started' }] };

	it("links a finished assistant turn to its surface's inspector with both ids in the query", () => {
		expect(inspectTurnPath('chatbot', 'cnv_1', { ...assistant(finished), id: 'msg_1' })).toBe(
			'/showcases/ai/chatbot?conversation=cnv_1&turn=msg_1#orchestration',
		);
		expect(inspectTurnPath('deskbot', 'cnv_1', { ...assistant(finished), id: 'msg_1' })).toBe(
			'/showcases/ai/deskbot?conversation=cnv_1&turn=msg_1#orchestration',
		);
	});

	it('links nothing while the turn runs, before a conversation exists, or for a user message', () => {
		expect(inspectTurnPath('chatbot', 'cnv_1', { ...assistant(running), id: 'msg_1' })).toBeNull();
		expect(inspectTurnPath('chatbot', undefined, { ...assistant(finished), id: 'msg_1' })).toBeNull();
		expect(inspectTurnPath('chatbot', 'cnv_1', { ...assistant(), id: 'msg_1' })).toBeNull();
		expect(
			inspectTurnPath('chatbot', 'cnv_1', { id: 'u1', role: 'user', parts: [], metadata: { trace: finished } }),
		).toBeNull();
	});
});
