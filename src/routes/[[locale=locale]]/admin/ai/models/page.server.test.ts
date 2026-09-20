import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderEntry, ProviderRegistry } from '$lib/server/ai/connections';

const ADMIN = { user: { id: 'admin-1', email: 'admin@example.test' }, session: {} };
const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const ai = vi.hoisted(() => ({ loadProviderRegistry: vi.fn() }));
const settings = vi.hoisted(() => ({
	saveProviderConnectionSettings: vi.fn(),
	removeProviderConnectionKey: vi.fn(),
	setProjectDefaultProvider: vi.fn(),
	runProviderConnectionTest: vi.fn(),
}));
const limiter = vi.hoisted(() => ({ limit: vi.fn(async () => ({ success: true, reset: 0 })) }));
const security = vi.hoisted(() => ({ getEncryptionKey: vi.fn(() => 'k') }));

vi.mock('$lib/server/http/guards', () => guards);
vi.mock('$lib/server/ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai')>()),
	loadProviderRegistry: ai.loadProviderRegistry,
}));
vi.mock('$lib/server/ai/connection-settings', () => settings);
vi.mock('$lib/server/ai/providers', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai/providers')>()),
	getCooldownResumeAt: vi.fn(async () => null),
}));
vi.mock('$lib/server/http/rate-limit', () => ({ createLimiter: () => limiter }));
vi.mock('$lib/server/security', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/security')>()),
	getEncryptionKey: security.getEncryptionKey,
}));
vi.mock('$lib/server/db', () => ({ db: {} }));

const { actions, load } = await import('./+page.server');

const PLAINTEXT = 'sk-live-should-never-echo';
const CIPHERTEXT = 'bm9uY2U=:Y2lwaGVy';

function entry(overrides: Partial<ProviderEntry> & { id: ProviderEntry['id'] }): ProviderEntry {
	return {
		name: overrides.id,
		enabled: true,
		keyStatus: 'ready',
		configured: true,
		modelId: 'saved-model',
		capabilities: { tools: true, vision: true, recognized: true },
		isDefault: false,
		version: 2,
		updatedAt: new Date('2026-09-11T10:00:00Z'),
		updatedBy: 'admin-1',
		getInstance: () => ({}) as never,
		...overrides,
	};
}

function registryOf(...entries: ProviderEntry[]): ProviderRegistry {
	return {
		entries,
		defaultProviderId: entries.find((e) => e.isDefault)?.id ?? null,
		degraded: false,
		embeddingConnection: () => ({ unavailable: 'disabled' }),
	};
}

function formEvent(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [k, v] of Object.entries(fields)) formData.set(k, v);
	return {
		locals: {},
		request: { formData: async () => formData },
		getClientAddress: () => '127.0.0.1',
	} as unknown as Parameters<NonNullable<typeof actions.save>>[0];
}

const loadEvent = () => ({ locals: {} }) as unknown as Parameters<typeof load>[0];

beforeEach(() => {
	vi.clearAllMocks();
	guards.requireAdmin.mockImplementation(() => ADMIN);
	security.getEncryptionKey.mockReturnValue('k');
	ai.loadProviderRegistry.mockResolvedValue(
		registryOf(entry({ id: 'groq', isDefault: true }), entry({ id: 'openai' }), entry({ id: 'google' })),
	);
});

describe('/admin/ai/models load', () => {
	it('requires admin and ships only the public projection', async () => {
		const data = (await load(loadEvent())) as {
			connections: unknown[];
			unavailable: boolean;
		};
		expect(guards.requireAdmin).toHaveBeenCalled();
		expect(data.unavailable).toBe(false);
		const serialized = JSON.stringify(data);
		expect(serialized).not.toContain('getInstance');
		expect(serialized).not.toContain('apiKeyCiphertext');
		expect(serialized).not.toContain(CIPHERTEXT);
	});

	it('renders the setup form when the settings table cannot be read', async () => {
		ai.loadProviderRegistry.mockRejectedValue(new Error('relation "ai.provider_connection" does not exist'));
		const data = (await load(loadEvent())) as { unavailable: boolean; connections: unknown[] };
		expect(data.unavailable).toBe(true);
		expect(data.connections).toEqual([]);
	});

	it('propagates the admin guard rejection', async () => {
		guards.requireAdmin.mockImplementation(() => {
			throw new Error('Not Found');
		});
		await expect(load(loadEvent())).rejects.toThrow(/Not Found/);
	});
});

describe('/admin/ai/models actions', () => {
	it('every action requires admin', async () => {
		guards.requireAdmin.mockImplementation(() => {
			throw new Error('Not Found');
		});
		for (const action of ['save', 'test', 'removeKey', 'setDefault'] as const) {
			await expect(actions[action]?.(formEvent({}))).rejects.toThrow(/Not Found/);
		}
		expect(settings.saveProviderConnectionSettings).not.toHaveBeenCalled();
	});

	it('save hands the key to the domain and never echoes it back', async () => {
		settings.saveProviderConnectionSettings.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		const result = await actions.save?.(
			formEvent({ provider: 'openai', enabled: 'true', modelId: 'gpt-4o-mini', apiKey: PLAINTEXT, version: '2' }),
		);
		expect(settings.saveProviderConnectionSettings).toHaveBeenCalledWith(
			{ provider: 'openai', enabled: true, modelId: 'gpt-4o-mini', apiKey: PLAINTEXT, expectedVersion: 2 },
			{ id: 'admin-1', email: 'admin@example.test', ip: '127.0.0.1' },
		);
		expect(JSON.stringify(result)).not.toContain(PLAINTEXT);
		expect(result).toMatchObject({ saved: { provider: 'openai', version: 3 } });
	});

	it('save treats an empty key field as "keep"', async () => {
		settings.saveProviderConnectionSettings.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		await actions.save?.(formEvent({ provider: 'openai', enabled: 'false', modelId: 'm', apiKey: '', version: '2' }));
		expect(settings.saveProviderConnectionSettings.mock.calls[0]?.[0].apiKey).toBeUndefined();
	});

	it('validation failures carry a message and nothing typed into the form', async () => {
		const result = await actions.save?.(
			formEvent({ provider: 'openai', enabled: 'true', modelId: 'bad model!', apiKey: PLAINTEXT, version: '2' }),
		);
		expect(result).toMatchObject({ status: 400 });
		const serialized = JSON.stringify(result);
		expect(serialized).not.toContain(PLAINTEXT);
		expect(serialized).not.toContain('bad model!');
		expect(settings.saveProviderConnectionSettings).not.toHaveBeenCalled();
	});

	it('maps domain rejections to statuses', async () => {
		settings.saveProviderConnectionSettings
			.mockResolvedValueOnce({ ok: false, rejected: 'conflict' })
			.mockResolvedValueOnce({ ok: false, rejected: 'default_unusable' })
			.mockResolvedValueOnce({ ok: false, rejected: 'encryption_unconfigured' });
		const fields = { provider: 'groq', enabled: 'false', modelId: 'm', version: '2' };
		expect(await actions.save?.(formEvent(fields))).toMatchObject({ status: 409 });
		expect(await actions.save?.(formEvent(fields))).toMatchObject({ status: 400 });
		expect(await actions.save?.(formEvent(fields))).toMatchObject({ status: 500 });
	});

	it('test uses the draft key without saving and returns only the classified outcome', async () => {
		settings.runProviderConnectionTest.mockResolvedValue({
			ok: true,
			auditRecorded: true,
			test: {
				provider: 'openai',
				modelId: 'draft-model',
				target: 'draft',
				version: 2,
				outcome: 'ok',
				latencyMs: 40,
				testedAt: 't',
			},
		});
		const result = await actions.test?.(
			formEvent({ provider: 'openai', modelId: 'draft-model', apiKey: PLAINTEXT, version: '2' }),
		);
		expect(settings.runProviderConnectionTest).toHaveBeenCalledWith(
			{ provider: 'openai', modelId: 'draft-model', draftApiKey: PLAINTEXT },
			expect.objectContaining({ id: 'admin-1' }),
		);
		expect(settings.saveProviderConnectionSettings).not.toHaveBeenCalled();
		expect(JSON.stringify(result)).not.toContain(PLAINTEXT);
		expect(result).toMatchObject({ test: { target: 'draft', outcome: 'ok' } });
	});

	it('test is rate-limited per admin with a form failure, not a Response', async () => {
		limiter.limit.mockResolvedValueOnce({ success: false, reset: 0 });
		const result = await actions.test?.(formEvent({ provider: 'openai', modelId: 'm' }));
		expect(result).toMatchObject({ status: 429 });
		expect(result).not.toBeInstanceOf(Response);
		expect(settings.runProviderConnectionTest).not.toHaveBeenCalled();
	});

	it('removeKey and setDefault translate their forms', async () => {
		settings.removeProviderConnectionKey.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		expect(await actions.removeKey?.(formEvent({ provider: 'openai', version: '2' }))).toMatchObject({
			saved: { provider: 'openai', version: 3 },
		});
		expect(settings.removeProviderConnectionKey).toHaveBeenCalledWith(
			{ provider: 'openai', expectedVersion: 2 },
			expect.anything(),
		);

		settings.setProjectDefaultProvider.mockResolvedValue({ ok: true, auditRecorded: true });
		expect(
			await actions.setDefault?.(formEvent({ provider: 'automatic', expectedCurrentDefault: 'groq' })),
		).toMatchObject({ message: expect.stringContaining('Automatic') });
		expect(settings.setProjectDefaultProvider).toHaveBeenCalledWith(
			{ provider: null, expectedCurrentDefault: 'groq' },
			expect.anything(),
		);
	});
});
