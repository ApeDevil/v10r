/**
 * `delegate_architecture_review` at the tool boundary: it spends the budget, prepares through
 * the external-operations domain (content screen, then the adapter), stashes the prepared
 * operation for the orchestrator's proposal and answers the sentinel — and never executes. The
 * adapter is a fake here; `a2a/external-adapter.test.ts` runs the real one.
 */
import { describe, expect, it } from 'vitest';
import { createDelegationBudget } from '#lib/server/a2a/index.ts';
import {
	type ExternalDisclosureDraft,
	type ExternalOperationAdapter,
	type ExternalOperationBinding,
	externalArgumentsDigest,
	type PreparedExternalOperation,
} from '#lib/server/external-operations/index.ts';
import { agentDelegation } from '../capabilities/agent-delegation';
import { isApprovalSentinel } from '../proposals/approval-boundary';
import { createDelegateReviewTool, type DelegationTurnContext, unconfiguredDelegation } from './delegate-review';

const disclosure: ExternalDisclosureDraft = {
	protocol: 'a2a',
	peerId: 'reviewer',
	peerLabel: 'Independent reviewer',
	destination: 'https://reviews.example',
	operation: 'architecture-review',
	fields: ['model'],
	preview: 'architecture model',
	bytes: 100,
	credential: { kind: 'none' },
	mutates: false,
	reversibility: 'unknown',
	grant: 'once',
};
const MODEL = { format: 1 };
const binding = (args: unknown): ExternalOperationBinding => ({
	protocol: 'a2a',
	peerId: 'reviewer',
	endpoint: 'https://reviews.example/a2a',
	operation: 'architecture-review',
	contractDigest: 'card',
	policyDigest: 'policy',
	argumentsDigest: externalArgumentsDigest(args),
	userId: 'user-1',
	expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

function context(overrides: Partial<DelegationTurnContext> = {}) {
	const calls = { prepare: 0, execute: 0 };
	const adapter: ExternalOperationAdapter = {
		protocol: 'a2a',
		prepare: async (request) => {
			calls.prepare++;
			return { ok: true, disclosure, binding: binding(request.arguments) };
		},
		verify: async () => ({ ok: true }),
		execute: async () => {
			calls.execute++;
			return { outcome: 'succeeded', delivery: 'sent' };
		},
	};
	const ctx: DelegationTurnContext = {
		adapter,
		peers: [{ id: 'reviewer', label: 'Independent reviewer', skills: ['architecture-review'] }],
		budget: createDelegationBudget({ depth: 0, proposedInConversation: 0 }),
		conversationId: 'conv-1',
		...overrides,
	};
	return { ctx, calls, stash: new Map<string, PreparedExternalOperation>() };
}

const run = (
	ctx: DelegationTurnContext,
	stash = new Map<string, PreparedExternalOperation>(),
	signal?: AbortSignal,
	model: unknown = MODEL,
) =>
	createDelegateReviewTool('user-1', ctx, stash).execute?.(
		{ peer_id: 'reviewer', skill: 'architecture-review', model },
		{ toolCallId: 'c', messages: [], abortSignal: signal ?? new AbortController().signal, context: {} },
	);

describe('delegate_architecture_review', () => {
	it('stashes the prepared operation and answers the approval sentinel — never executes', async () => {
		const { ctx, calls, stash } = context();
		const output = await run(ctx, stash);
		expect(isApprovalSentinel(output)).toBe(true);
		expect((output as { action: string }).action).toContain('https://reviews.example');
		expect(calls).toEqual({ prepare: 1, execute: 0 });
		const prepared = stash.get('c');
		expect(prepared?.toolName).toBe('delegate_architecture_review');
		expect(prepared?.disclosure).toMatchObject({ ...disclosure, contentClass: 'arguments_only' });
	});

	it('the content screen refuses a credential in the model before the adapter is asked', async () => {
		const { ctx, calls, stash } = context();
		const leaked = { format: 1, note: `token ghp_${'a'.repeat(36)}` };
		expect(await run(ctx, stash, undefined, leaked)).toMatchObject({ refusal: 'secret_in_arguments' });
		expect(calls.prepare).toBe(0);
		expect(stash.size).toBe(0);
	});

	it('a second call in the turn is refused by the budget before anything is prepared', async () => {
		const { ctx, calls } = context();
		await run(ctx);
		expect(await run(ctx)).toMatchObject({ refusal: 'turn_budget' });
		expect(calls.prepare).toBe(1);
	});

	it('a delegated turn cannot delegate again', async () => {
		const { ctx, calls } = context({ budget: createDelegationBudget({ depth: 1, proposedInConversation: 0 }) });
		expect(await run(ctx)).toMatchObject({ refusal: 'depth' });
		expect(calls.prepare).toBe(0);
	});

	it('an adapter refusal is answered as such and nothing is proposed', async () => {
		const { ctx, stash } = context();
		ctx.adapter.prepare = async () => ({ ok: false, reason: 'skill_not_allowed' });
		expect(await run(ctx, stash)).toMatchObject({ refusal: 'skill_not_allowed' });
		expect(stash.size).toBe(0);
	});

	it('a cancelled turn does nothing', async () => {
		const { ctx, calls, stash } = context();
		await run(ctx, stash, AbortSignal.abort());
		expect(calls).toEqual({ prepare: 0, execute: 0 });
		expect(stash.size).toBe(0);
	});

	it('without a wired context every proposal is refused', async () => {
		expect(await run(unconfiguredDelegation())).toMatchObject({ refusal: 'no_peers' });
	});
});

describe('the agent-delegation capability', () => {
	const turn = (delegation?: DelegationTurnContext) =>
		({ hasTools: true, toolsCooled: false, delegation }) as Parameters<typeof agentDelegation.activates>[0];

	it('is inactive on every turn without a delegation context (no operator peers)', () => {
		expect(agentDelegation.activates(turn())).toEqual({ active: false, reason: 'no_peers' });
		expect(agentDelegation.activates(turn({ ...context().ctx, peers: [] }))).toEqual({
			active: false,
			reason: 'no_peers',
		});
	});

	it('is active when the orchestrator built a context over operator peers', () => {
		expect(agentDelegation.activates(turn(context().ctx))).toEqual({ active: true });
	});
});
