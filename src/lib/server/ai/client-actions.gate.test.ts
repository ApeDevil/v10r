/**
 * CLIENT ACTIONS GATE.
 *
 * A client action is executed by the user's browser, and its result is the browser's word.
 * That is fine for rearranging panels and wrong for anything that changes stored data: the
 * approval gate replays a mutation ON THE SERVER, against a reviewed baseline, and records
 * who approved it — none of which a browser can stand in for. This gate holds the line
 * between the two, so adding a client action can never quietly open a second write path:
 *
 *   - where a tool runs (`executor`) and what it changes (`risk`) are declared separately,
 *     and the one forbidden combination — client-executed and data-changing — fails here;
 *   - a client-executed tool is never one the approval door can replay;
 *   - it has no server `execute` (there is nothing for the server to run), and every
 *     server tool has one (nothing is left for a browser to answer by accident);
 *   - its result is treated as user content, and it has a declared contract on both sides.
 */
import { safeParse } from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { DESK_ARRANGE_ACTION_NAMES, DESK_ARRANGE_ACTIONS } from '#lib/desk/arrange-actions.ts';
import { DESK_TOOL_SCOPES, TOOL_MANIFEST } from '#lib/types/ai-tools.ts';

vi.mock('#lib/server/db/index.ts', () => ({ db: {} }));
vi.mock('#lib/server/retrieval/index.ts', () => ({
	generateEmbedding: vi.fn(async () => []),
	retrieve: vi.fn(async () => ({ chunks: [], totalFound: 0 })),
	formatContextForPrompt: vi.fn(() => ''),
	contextChunkCut: (result: { chunks: unknown[] }) => result.chunks.length,
}));

const { isClientExecuted } = await import('./client-action-results');
const { requiresApproval } = await import('./policy/governor');
const { composeTurn, PROFILES } = await import('./profile');
const { DESK_EXECUTABLE_TOOLS } = await import('./tools/desk-execute');
const { DESK_MUTATION_INPUTS } = await import('./tools/desk-mutation-inputs');
const { resultOriginOf } = await import('./untrusted-content');
const { ChatbotRequestSchema, DeskRequestSchema } = await import('./validation');

const clientExecuted = TOOL_MANIFEST.filter((d) => d.executor === 'client');
const message = { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] };

describe('client-executed tools never change stored data', () => {
	it('there is at least one, or this gate guards nothing', () => {
		expect(clientExecuted.length).toBeGreaterThan(0);
	});

	it.each(clientExecuted.map((d) => [d.name, d] as const))('%s carries a risk no approval is owed for', (_name, d) => {
		expect(['read', 'view']).toContain(d.risk);
		expect(requiresApproval(d.risk)).toBe(false);
	});

	it.each(clientExecuted.map((d) => d.name))('%s is not a tool the approval door can replay', (name) => {
		expect(DESK_EXECUTABLE_TOOLS as readonly string[]).not.toContain(name);
		expect(Object.keys(DESK_MUTATION_INPUTS)).not.toContain(name);
	});

	it.each(
		clientExecuted.map((d) => [d.name, d] as const),
	)('%s answers with user content that stays inside the deployment', (name, d) => {
		expect(d.resultOrigin).toBe('user');
		expect(resultOriginOf(name)).toBe('user');
		expect(d.reach).toBe('internal');
		expect(isClientExecuted(name)).toBe(true);
	});
});

describe('client-executed tools ≡ declared client actions', () => {
	it('every client-executed manifest tool has a contract, and every contract a manifest entry', () => {
		expect(clientExecuted.map((d) => d.name).sort()).toEqual([...DESK_ARRANGE_ACTION_NAMES].sort());
	});

	it('every contract bounds how long its handler may run', () => {
		for (const action of DESK_ARRANGE_ACTIONS) {
			expect(action.timeoutMs, action.name).toBeGreaterThan(0);
			expect(action.timeoutMs, action.name).toBeLessThanOrEqual(10_000);
		}
	});
});

describe('the server runs exactly the tools that are its own', () => {
	it('a client-executed tool has no execute; every other mounted tool has one', async () => {
		const composed = await composeTurn(PROFILES.deskbot, {
			userId: 'user-1',
			userMsgText: 'open the budget',
			locale: 'en',
			authCeiling: 'user',
			hasTools: true,
			toolsCooled: false,
			pageContext: null,
			scopes: [...DESK_TOOL_SCOPES],
			deskCorpus: 'ready',
			clientActions: DESK_ARRANGE_ACTION_NAMES,
		});
		const mounted = Object.entries(composed.tools) as [string, { execute?: unknown }][];
		expect(mounted.map(([name]) => name)).toEqual(expect.arrayContaining([...DESK_ARRANGE_ACTION_NAMES]));
		for (const [name, tool] of mounted) {
			if (isClientExecuted(name)) expect(tool.execute, `${name} must not run on the server`).toBeUndefined();
			else expect(tool.execute, `${name} has nothing to run it`).toEqual(expect.any(Function));
		}
	});
});

describe('what a client may advertise', () => {
	it('the deskbot route accepts declared client actions and refuses any other name', () => {
		expect(safeParse(DeskRequestSchema, { messages: [message], clientActions: ['desk_open_file'] }).success).toBe(true);
		expect(safeParse(DeskRequestSchema, { messages: [message], clientActions: ['desk_delete_file'] }).success).toBe(
			false,
		);
		expect(safeParse(DeskRequestSchema, { messages: [message], clientActions: ['run_script'] }).success).toBe(false);
	});

	it('the chatbot route carries none into a turn — Vely reads, it never acts', () => {
		const parsed = safeParse(ChatbotRequestSchema, { messages: [message], clientActions: ['desk_open_file'] });
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'clientActions' in parsed.output).toBe(false);
		expect(TOOL_MANIFEST.filter((d) => d.surface === 'chatbot' && d.executor === 'client')).toEqual([]);
	});
});
