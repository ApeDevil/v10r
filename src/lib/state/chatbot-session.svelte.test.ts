/**
 * The embedded host — a page showing the thread in place of the dock (the chatbot
 * showcase's example). What a browser test cannot pin reliably:
 *   - `open()` readies the thread without docking it while a host is attached;
 *   - a turn sent from the page parks the thread (`minimized`) so the sidebar and the
 *     bubble offer it back once the visitor leaves;
 *   - the release restores the dock's behaviour.
 * `browser` is mocked true so the mutators run; the AI SDK client is a stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const sendMessage = vi.fn();
vi.mock('./chat-client', () => ({
	Chat: class {
		messages: unknown[] = [];
		status = 'ready';
		sendMessage = sendMessage;
		stop = vi.fn();
		clearError = vi.fn();
	},
	DefaultChatTransport: class {},
}));

const { chatbotSession } = await import('./chatbot-session.svelte');

beforeEach(() => {
	vi.stubGlobal('sessionStorage', {
		getItem: () => null,
		setItem: () => undefined,
		removeItem: () => undefined,
	});
	vi.stubGlobal('fetch', vi.fn());
	chatbotSession.setUser('user_1');
});

afterEach(() => {
	chatbotSession.reset();
	chatbotSession.embedded = false;
	sendMessage.mockClear();
	vi.unstubAllGlobals();
});

describe('embedded host', () => {
	it('readies the thread on open() without docking it while a host is attached', async () => {
		const release = chatbotSession.attachEmbeddedHost();
		expect(chatbotSession.embedded).toBe(true);

		await chatbotSession.open();
		expect(chatbotSession.chat).not.toBeNull();
		expect(chatbotSession.phase).toBe('closed');

		release();
		expect(chatbotSession.embedded).toBe(false);
		await chatbotSession.open();
		expect(chatbotSession.phase).toBe('open');
	});

	it('parks a thread the page started, so the visitor finds it after leaving', async () => {
		chatbotSession.attachEmbeddedHost();
		await chatbotSession.submit('How does grounding work?');
		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(chatbotSession.phase).toBe('minimized');
	});

	it('never minimizes an open dock from Ctrl+J while a host is attached, and reset() keeps the host', async () => {
		await chatbotSession.open();
		expect(chatbotSession.phase).toBe('open');
		const release = chatbotSession.attachEmbeddedHost();
		chatbotSession.toggle();
		expect(chatbotSession.phase).toBe('open');

		chatbotSession.reset();
		expect(chatbotSession.embedded).toBe(true);
		release();
	});
});
