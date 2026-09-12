import { describe, expect, it } from 'vitest';
import { awaitingAnswer, type PipelineEvents, type StreamedMessage, turnProgress } from './turn-progress';

const step = (step: string, status: string, instanceKey?: string) => ({
	type: 'pipeline:step',
	step,
	status,
	instanceKey,
});
const assistant = (pipeline?: PipelineEvents): StreamedMessage => ({
	role: 'assistant',
	parts: [],
	metadata: pipeline ? { pipeline } : undefined,
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
	it('is null before the first metadata frame, once every step has settled, and for a user message', () => {
		expect(turnProgress(undefined)).toBeNull();
		expect(turnProgress(assistant())).toBeNull();
		expect(turnProgress(assistant([]))).toBeNull();
		expect(turnProgress(assistant([step('embed', 'active'), step('embed', 'done')]))).toBeNull();
		expect(turnProgress({ role: 'user', parts: [], metadata: { pipeline: [step('embed', 'active')] } })).toBeNull();
	});

	it('names the most recently started step that is still active', () => {
		const lanes: PipelineEvents = [
			step('embed', 'active'),
			step('system-docs', 'active'),
			step('catalog', 'active'),
			step('embed', 'done'),
		];
		// catalog started last and is still active.
		expect(turnProgress(assistant(lanes))).toBe('catalog');
		expect(turnProgress(assistant([...lanes, step('catalog', 'done')]))).toBe('retrieving');
		expect(
			turnProgress(
				assistant([...lanes, step('catalog', 'done'), step('system-docs', 'done'), step('generate', 'active')]),
			),
		).toBe('generating');
	});

	it('keys dynamic steps by instance so a finished drill does not shadow the live generate', () => {
		expect(
			turnProgress(
				assistant([
					step('generate', 'active'),
					step('chunks:drill', 'done', 'drill#0'),
					step('chunks:drill', 'done', 'drill#1'),
				]),
			),
		).toBe('generating');
	});

	it('ignores events that are not steps', () => {
		expect(turnProgress(assistant([{ type: 'pipeline:chunks' }, step('llmwiki:search', 'active')]))).toBe('retrieving');
	});
});
