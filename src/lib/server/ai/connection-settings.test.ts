import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderEntry, ProviderRegistry } from './connections';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const PLAINTEXT = 'gsk_brand_new_key_value';

const dbAccess = vi.hoisted(() => ({
	saveProviderConnection: vi.fn(),
	removeProviderKey: vi.fn(),
	setDefaultProvider: vi.fn(),
}));
const admin = vi.hoisted(() => ({ recordAuditEvent: vi.fn() }));
const security = vi.hoisted(() => ({ getEncryptionKey: vi.fn() }));
const registryLoader = vi.hoisted(() => ({ loadProviderRegistry: vi.fn() }));
const probe = vi.hoisted(() => ({ testLanguageModel: vi.fn() }));

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/ai/provider-connections', () => dbAccess);
vi.mock('$lib/server/admin', () => admin);
vi.mock('$lib/server/security', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/security')>()),
	getEncryptionKey: security.getEncryptionKey,
}));
vi.mock('./index', () => registryLoader);
vi.mock('./connection-test', () => probe);

const { EncryptionError } = await import('$lib/server/security');
const {
	removeProviderConnectionKey,
	runProviderConnectionTest,
	saveProviderConnectionSettings,
	setProjectDefaultProvider,
} = await import('./connection-settings');

const actor = { id: 'admin-1', email: 'admin@example.test', ip: '127.0.0.1' };

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
		updatedAt: null,
		updatedBy: null,
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

beforeEach(() => {
	vi.clearAllMocks();
	security.getEncryptionKey.mockReturnValue(KEY);
	admin.recordAuditEvent.mockResolvedValue(undefined);
	registryLoader.loadProviderRegistry.mockResolvedValue(
		registryOf(entry({ id: 'groq', isDefault: true }), entry({ id: 'openai' }), entry({ id: 'google' })),
	);
});

describe('saveProviderConnectionSettings', () => {
	it('seals the key before it reaches the database and keeps it out of the audit detail', async () => {
		dbAccess.saveProviderConnection.mockResolvedValue({ ok: true, version: 3 });
		const result = await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'gpt-4o-mini', apiKey: PLAINTEXT, expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: true, version: 3, auditRecorded: true });

		const written = dbAccess.saveProviderConnection.mock.calls[0]?.[1];
		expect(written.apiKeyCiphertext).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
		expect(written.apiKeyCiphertext).not.toContain(PLAINTEXT);
		expect(JSON.stringify(written)).not.toContain(PLAINTEXT);

		const audit = admin.recordAuditEvent.mock.calls[0]?.[0];
		expect(audit).toMatchObject({ action: 'ai.provider.save', targetId: 'openai', actorId: 'admin-1' });
		expect(audit.detail).toMatchObject({ version: 3, keyChange: 'replaced', changedFields: ['modelId', 'apiKey'] });
		expect(JSON.stringify(audit)).not.toContain(PLAINTEXT);
		expect(JSON.stringify(audit)).not.toContain(written.apiKeyCiphertext);
	});

	it('keeps the stored key when the field is empty', async () => {
		dbAccess.saveProviderConnection.mockResolvedValue({ ok: true, version: 3 });
		await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'saved-model', apiKey: '', expectedVersion: 2 },
			actor,
		);
		expect(dbAccess.saveProviderConnection.mock.calls[0]?.[1].apiKeyCiphertext).toBeUndefined();
		expect(admin.recordAuditEvent.mock.calls[0]?.[0].detail).toMatchObject({ keyChange: 'kept', changedFields: [] });
	});

	it('refuses to disable the current default without touching the row', async () => {
		const result = await saveProviderConnectionSettings(
			{ provider: 'groq', enabled: false, modelId: 'saved-model', expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: false, rejected: 'default_unusable' });
		expect(dbAccess.saveProviderConnection).not.toHaveBeenCalled();
	});

	it('refuses a new key when the deployment has no usable encryption key, writing nothing', async () => {
		security.getEncryptionKey.mockImplementation(() => {
			throw new EncryptionError('invalid_key', 'missing');
		});
		const result = await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'm', apiKey: PLAINTEXT, expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: false, rejected: 'encryption_unconfigured' });
		expect(dbAccess.saveProviderConnection).not.toHaveBeenCalled();
	});

	it('surfaces a version conflict', async () => {
		dbAccess.saveProviderConnection.mockResolvedValue({ conflict: true });
		const result = await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'm', expectedVersion: 1 },
			actor,
		);
		expect(result).toEqual({ ok: false, rejected: 'conflict' });
		expect(admin.recordAuditEvent).not.toHaveBeenCalled();
	});

	it('maps a check violation from the database to the default rule', async () => {
		dbAccess.saveProviderConnection.mockRejectedValue(Object.assign(new Error('check'), { code: '23514' }));
		const result = await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'm', expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: false, rejected: 'default_unusable' });
	});

	it('reports a saved change even when the audit row fails', async () => {
		dbAccess.saveProviderConnection.mockResolvedValue({ ok: true, version: 3 });
		admin.recordAuditEvent.mockRejectedValue(new Error('audit down'));
		const result = await saveProviderConnectionSettings(
			{ provider: 'openai', enabled: true, modelId: 'm', expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: true, version: 3, auditRecorded: false });
	});
});

describe('removeProviderConnectionKey', () => {
	it('refuses when there is no key or the provider is the default', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(
			registryOf(entry({ id: 'groq', isDefault: true }), entry({ id: 'openai', keyStatus: 'none', configured: false })),
		);
		expect(await removeProviderConnectionKey({ provider: 'openai', expectedVersion: 2 }, actor)).toEqual({
			ok: false,
			rejected: 'no_key',
		});
		expect(await removeProviderConnectionKey({ provider: 'groq', expectedVersion: 2 }, actor)).toEqual({
			ok: false,
			rejected: 'default_unusable',
		});
		expect(dbAccess.removeProviderKey).not.toHaveBeenCalled();
	});

	it('removes and audits', async () => {
		dbAccess.removeProviderKey.mockResolvedValue({ ok: true, version: 3 });
		expect(await removeProviderConnectionKey({ provider: 'openai', expectedVersion: 2 }, actor)).toEqual({
			ok: true,
			version: 3,
			auditRecorded: true,
		});
		expect(admin.recordAuditEvent.mock.calls[0]?.[0]).toMatchObject({
			action: 'ai.provider.key.remove',
			detail: { keyChange: 'removed', version: 3 },
		});
	});
});

describe('setProjectDefaultProvider', () => {
	it('maps the write outcomes and audits from → to', async () => {
		dbAccess.setDefaultProvider
			.mockResolvedValueOnce({ conflict: true })
			.mockResolvedValueOnce({ unusable: true })
			.mockResolvedValueOnce({ ok: true });
		expect(await setProjectDefaultProvider({ provider: 'openai', expectedCurrentDefault: 'groq' }, actor)).toEqual({
			ok: false,
			rejected: 'conflict',
		});
		expect(await setProjectDefaultProvider({ provider: 'openai', expectedCurrentDefault: 'groq' }, actor)).toEqual({
			ok: false,
			rejected: 'default_unusable',
		});
		expect(await setProjectDefaultProvider({ provider: null, expectedCurrentDefault: 'groq' }, actor)).toEqual({
			ok: true,
			auditRecorded: true,
		});
		expect(admin.recordAuditEvent.mock.calls[0]?.[0]).toMatchObject({
			action: 'ai.provider.default.set',
			detail: { from: 'groq', to: 'automatic' },
		});
	});
});

describe('runProviderConnectionTest', () => {
	it('tests a draft key without writing anything and labels the result as a draft', async () => {
		probe.testLanguageModel.mockResolvedValue({ outcome: 'ok', latencyMs: 12, testedAt: 't' });
		const result = await runProviderConnectionTest(
			{ provider: 'openai', modelId: 'saved-model', draftApiKey: PLAINTEXT },
			actor,
		);
		expect(result).toMatchObject({
			ok: true,
			test: { provider: 'openai', target: 'draft', version: 2, outcome: 'ok' },
		});
		expect(dbAccess.saveProviderConnection).not.toHaveBeenCalled();
		expect(dbAccess.setDefaultProvider).not.toHaveBeenCalled();
		expect(JSON.stringify(admin.recordAuditEvent.mock.calls[0]?.[0])).not.toContain(PLAINTEXT);
	});

	it('labels a test of the saved key and model as saved, and a changed model as a draft', async () => {
		probe.testLanguageModel.mockResolvedValue({ outcome: 'ok', latencyMs: 12, testedAt: 't' });
		expect(await runProviderConnectionTest({ provider: 'openai', modelId: 'saved-model' }, actor)).toMatchObject({
			test: { target: 'saved' },
		});
		expect(await runProviderConnectionTest({ provider: 'openai', modelId: 'other-model' }, actor)).toMatchObject({
			test: { target: 'draft' },
		});
	});

	it('refuses when there is neither a draft nor a stored key', async () => {
		registryLoader.loadProviderRegistry.mockResolvedValue(
			registryOf(entry({ id: 'openai', keyStatus: 'none', configured: false, getInstance: () => null })),
		);
		expect(await runProviderConnectionTest({ provider: 'openai', modelId: 'm' }, actor)).toEqual({
			ok: false,
			rejected: 'no_key',
		});
		expect(probe.testLanguageModel).not.toHaveBeenCalled();
	});
});
