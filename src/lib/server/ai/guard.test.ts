import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderEntry, ProviderRegistry } from './connections';

const registryLoader = vi.hoisted(() => ({ loadProviderRegistry: vi.fn() }));
const budget = vi.hoisted(() => ({ checkUserBudget: vi.fn(async () => ({ allowed: true })) }));
const limiter = vi.hoisted(() => ({ limit: vi.fn(async () => ({ success: true, reset: 0 })) }));

vi.mock('$lib/server/ai', () => registryLoader);
vi.mock('$lib/server/ai/budget', () => budget);
// Both denials are 429s; the body tells them apart.
vi.mock('$lib/server/abuse/decision.adapter', () => ({
	decisionResponse: vi.fn(() => new Response('budget', { status: 429 })),
}));
vi.mock('$lib/server/http/rate-limit', () => ({
	createLimiter: () => limiter,
	rateLimitResponse: () => new Response('rate-limit', { status: 429 }),
}));

const { guardAiRequest } = await import('./guard');

const locals = { user: { id: 'user-1' }, session: {} } as unknown as App.Locals;

function entry(configured: boolean): ProviderEntry {
	return {
		id: 'groq',
		name: 'Groq',
		enabled: configured,
		keyStatus: configured ? 'ready' : 'none',
		configured,
		modelId: 'm',
		capabilities: { tools: true, vision: false, recognized: true },
		isDefault: false,
		version: 1,
		updatedAt: null,
		updatedBy: null,
		getInstance: () => null,
	};
}

function registryOf(entries: ProviderEntry[], degraded = false): ProviderRegistry {
	return { entries, defaultProviderId: null, degraded, embeddingConnection: () => ({ unavailable: 'disabled' }) };
}

async function bodyOf(response: Response) {
	return (await response.json()) as { error: { code: string; message: string } };
}

describe('guardAiRequest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects anonymous callers before touching the settings', async () => {
		const result = await guardAiRequest({ user: null } as unknown as App.Locals);
		expect(result.response?.status).toBe(401);
		expect(registryLoader.loadProviderRegistry).not.toHaveBeenCalled();
	});

	it('answers 503 ai_unavailable with a setup hint when nothing is connected', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(registryOf([entry(false)]));
		const result = await guardAiRequest(locals);
		expect(result.response?.status).toBe(503);
		const body = await bodyOf(result.response as Response);
		expect(body.error.code).toBe('ai_unavailable');
		expect(body.error.message).toMatch(/administrator/);
		expect(body.error.message).not.toMatch(/environment|\.env|API_KEY/);
		expect(limiter.limit).not.toHaveBeenCalled();
	});

	it('answers 503 with a configuration message when a stored key will not decrypt', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(registryOf([entry(false)], true));
		const result = await guardAiRequest(locals);
		expect(result.response?.status).toBe(503);
		expect((await bodyOf(result.response as Response)).error.message).toMatch(/configuration/);
	});

	it('answers 503 when the settings cannot be read, never treating it as empty', async () => {
		registryLoader.loadProviderRegistry.mockRejectedValue(new Error('relation does not exist'));
		const result = await guardAiRequest(locals);
		expect(result.response?.status).toBe(503);
		expect((await bodyOf(result.response as Response)).error.message).toMatch(/unavailable/);
	});

	it('hands the loaded registry to the caller when a provider is connected', async () => {
		const registry = registryOf([entry(true)]);
		registryLoader.loadProviderRegistry.mockResolvedValue(registry);
		const result = await guardAiRequest(locals);
		expect(result.response).toBeUndefined();
		expect(result.user).toEqual({ id: 'user-1' });
		expect(result.registry).toBe(registry);
		expect(limiter.limit).toHaveBeenCalledWith('user-1');
		expect(budget.checkUserBudget).toHaveBeenCalledWith('user-1');
	});

	// The limiter and the budget are two Redis round trips with no data dependency; they are
	// issued together (the budget read no longer waits for the limiter's answer) and read in
	// the precedence order the sequential version had.
	it('issues the rate-limit and budget reads together; when both deny, the rate limit answers', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(registryOf([entry(true)]));
		limiter.limit.mockResolvedValueOnce({ success: false, reset: 0 });
		budget.checkUserBudget.mockResolvedValueOnce({ allowed: false });

		const result = await guardAiRequest(locals);

		expect(result.response?.status).toBe(429);
		expect(await result.response?.text()).toBe('rate-limit');
		// Proof of concurrency: the budget read happened even though the limiter denied.
		expect(budget.checkUserBudget).toHaveBeenCalledWith('user-1');
	});

	it('answers with the budget decision when only the budget denies', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(registryOf([entry(true)]));
		budget.checkUserBudget.mockResolvedValueOnce({ allowed: false });

		const result = await guardAiRequest(locals);

		expect(result.response?.status).toBe(429);
		expect(await result.response?.text()).toBe('budget');
	});
});
