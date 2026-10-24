/**
 * `dispatchMove` / `dispatchToggleAiContext` against the real `ExplorerState`, with the
 * network replaced by deferreds the test settles by hand — so interleavings are exact.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerState } from './explorer.state.svelte';
import { type ActionContext, dispatchMove, dispatchToggleAiContext } from './explorer-actions';
import type { ExplorerNode } from './node';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>() }));
vi.mock('#lib/api.ts', () => ({ apiFetch }));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function node(id: string, parentId: string | null, source: ExplorerNode['source'] = 'desk-folder'): ExplorerNode {
	return {
		id,
		parentId,
		source,
		sourceData: {},
		label: id,
		icon: 'i-lucide-folder',
		isFolder: source.endsWith('folder'),
		capabilities: new Set(['move', 'ai-context']),
		sortKey: `0_${id}`,
	};
}

const ok = () => new Response('{}', { status: 200 });
const conflict = () =>
	new Response(JSON.stringify({ error: { code: 'folder_name_conflict' } }), {
		status: 409,
		headers: { 'Content-Type': 'application/json' },
	});

let state: ExplorerState;
const refresh = vi.fn<ActionContext['refresh']>();
const setError = vi.fn<ActionContext['setError']>();
let ctx: ActionContext;
/** One deferred response per request, in issue order. */
let responses: ReturnType<typeof deferred<Response>>[];

beforeEach(() => {
	state = new ExplorerState();
	state.setNodes([node('P', null), node('X', null), node('Y', null), node('n', 'P'), node('f', 'P', 'desk-file')]);
	refresh.mockReset();
	refresh.mockResolvedValue(undefined);
	setError.mockReset();
	ctx = { refresh, setError, announce: () => {} };
	responses = [];
	apiFetch.mockReset();
	apiFetch.mockImplementation(() => {
		const response = deferred<Response>();
		responses.push(response);
		return response.promise;
	});
});

const parentOfN = () => state.getNode('n')?.parentId;

describe('dispatchMove', () => {
	it('shows the move at once and keeps it on success', async () => {
		const moving = dispatchMove(state, 'n', 'X', ctx);
		expect(parentOfN()).toBe('X');

		responses[0].resolve(ok());
		expect(await moving).toBe(true);
		expect(parentOfN()).toBe('X');
		expect(refresh).not.toHaveBeenCalled();
	});

	it('rolls back a single failed move to the confirmed parent', async () => {
		const moving = dispatchMove(state, 'n', 'X', ctx);
		responses[0].resolve(conflict());
		expect(await moving).toBe(false);
		expect(parentOfN()).toBe('P');
		expect(setError).toHaveBeenCalledOnce();
	});

	it('A in flight, B succeeds, A fails: the node ends at B', async () => {
		const a = dispatchMove(state, 'n', 'X', ctx);
		const b = dispatchMove(state, 'n', 'Y', ctx);
		expect(parentOfN()).toBe('Y');

		responses[1].resolve(ok());
		await b;
		expect(parentOfN()).toBe('Y');

		responses[0].resolve(conflict());
		await a;
		expect(parentOfN()).toBe('Y');
	});

	it('A in flight, B succeeds, A succeeds late: re-reads the server instead of guessing', async () => {
		const a = dispatchMove(state, 'n', 'X', ctx);
		const b = dispatchMove(state, 'n', 'Y', ctx);
		responses[1].resolve(ok());
		await b;
		responses[0].resolve(ok());
		await a;
		expect(refresh).toHaveBeenCalledOnce();
	});

	it('a network error rolls back only its own move', async () => {
		const a = dispatchMove(state, 'n', 'X', ctx);
		const b = dispatchMove(state, 'n', 'Y', ctx);
		responses[0].reject(new Error('offline'));
		await a;
		expect(parentOfN()).toBe('Y');
		responses[1].resolve(ok());
		await b;
		expect(parentOfN()).toBe('Y');
	});

	it('a duplicate submit of the same move sends one request', async () => {
		const first = dispatchMove(state, 'n', 'X', ctx);
		expect(await dispatchMove(state, 'n', 'X', ctx)).toBe(false);
		expect(apiFetch).toHaveBeenCalledOnce();

		responses[0].resolve(ok());
		await first;
		expect(parentOfN()).toBe('X');
	});

	it('X then Y then back to X while all are in flight shows X', async () => {
		const moves = [dispatchMove(state, 'n', 'X', ctx), dispatchMove(state, 'n', 'Y', ctx)];
		moves.push(dispatchMove(state, 'n', 'X', ctx));
		expect(apiFetch).toHaveBeenCalledTimes(3);
		expect(parentOfN()).toBe('X');
		for (const r of responses) r.resolve(ok());
		await Promise.all(moves);
		expect(parentOfN()).toBe('X');
	});

	it('a refresh landing mid-flight keeps the pending move shown', async () => {
		const moving = dispatchMove(state, 'n', 'X', ctx);
		state.setNodes([node('P', null), node('X', null), node('Y', null), node('n', 'P')]);
		expect(parentOfN()).toBe('X');
		responses[0].resolve(conflict());
		await moving;
		expect(parentOfN()).toBe('P');
	});
});

describe('dispatchToggleAiContext', () => {
	it('pin then unpin, pin fails after unpin confirmed: stays unpinned', async () => {
		const f = state.getNode('f') as ExplorerNode;
		const pin = dispatchToggleAiContext(state, f, ctx);
		expect(state.isAiPinned('f')).toBe(true);
		const unpin = dispatchToggleAiContext(state, f, ctx);
		expect(state.isAiPinned('f')).toBe(false);

		responses[1].resolve(ok());
		await unpin;
		responses[0].resolve(new Response('{}', { status: 500 }));
		await pin;
		expect(state.isAiPinned('f')).toBe(false);
	});

	it('a server rejection rolls the pin back', async () => {
		const f = state.getNode('f') as ExplorerNode;
		const pin = dispatchToggleAiContext(state, f, ctx);
		responses[0].resolve(new Response('{}', { status: 500 }));
		await pin;
		expect(state.isAiPinned('f')).toBe(false);
		expect(setError).toHaveBeenCalledOnce();
	});
});
