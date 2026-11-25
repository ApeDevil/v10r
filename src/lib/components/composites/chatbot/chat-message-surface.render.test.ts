/**
 * A `render_surface` part in the chat thread: the live render mounts the (lazy) surface in
 * place of the tool's status row; a superseded render shows nothing; a refused one keeps the
 * status row. Server-rendered, so the lazy renderer shows its loading line.
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { GENERATIVE_SURFACE_SCENARIOS } from '#lib/generative-ui/fixtures/index.ts';
import ChatMessage from './ChatMessage.svelte';
import { surfaceViewsOf } from './surface-views';

const form = GENERATIVE_SURFACE_SCENARIOS[0];
const part = (toolCallId: string, ok = true) => ({
	type: 'tool-render_surface',
	toolCallId,
	state: 'output-available' as const,
	input: {},
	output: ok
		? { ok, surfaceId: 'requirements', messages: form.messages }
		: { ok, surfaceId: 'requirements', refusals: [] },
});

const html = (parts: ReturnType<typeof part>[], allParts = parts) =>
	render(ChatMessage, {
		props: { role: 'assistant', parts, surfaceViews: surfaceViewsOf([{ parts: allParts }]) },
	}).body;

describe('ChatMessage with a generative surface', () => {
	it('mounts the live surface instead of a status row', () => {
		const body = html([part('c1')]);
		expect(body).toContain('chat-surface');
		expect(body).toContain('Loading the surface');
	});

	it('shows nothing for a render a later one superseded', () => {
		const body = html([part('c1')], [part('c1'), part('c2')]);
		expect(body).not.toContain('chat-surface');
	});

	it('keeps the status row for a refused render', () => {
		const body = html([part('c1', false)]);
		expect(body).not.toContain('chat-surface');
		expect(body).toContain('Preparing an interactive view');
	});
});

describe('ChatMessage with a surface press (the human-facing record)', () => {
	// The user row as persisted and served back on reload: the press as its data part, and a
	// plain fallback `content`. The bubble never shows the model's untrusted-content prompt.
	const record = {
		action: { surfaceId: 'requirements', name: 'collect_requirements', sourceComponentId: 'submit', context: {} },
		renderId: 'c1',
		eventId: '550e8400-e29b-41d4-a716-446655440000',
	};

	it('renders a restored press as one line in the user bubble', () => {
		const body = render(ChatMessage, {
			props: { role: 'user', parts: [{ type: 'data-surface-action', data: record } as never] },
		}).body;
		expect(body).toContain('data-surface-action-line');
		expect(body).toContain('Sent from the view: collect_requirements');
		expect(body).not.toContain('untrusted-content');
	});

	it('renders nothing for a malformed press part', () => {
		const body = render(ChatMessage, {
			props: { role: 'user', parts: [{ type: 'data-surface-action', data: { eventId: 'x' } } as never] },
		}).body;
		expect(body).not.toContain('data-surface-action-line');
	});
});
