import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NameSourceConnection, NameSourceConnections } from './connections';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const PLAINTEXT = 'tvly-brand-new-secret-value';

const dbAccess = vi.hoisted(() => ({ saveNameSourceConnection: vi.fn(), removeNameSourceSecret: vi.fn() }));
const admin = vi.hoisted(() => ({ recordAuditEvent: vi.fn() }));
const security = vi.hoisted(() => ({ getEncryptionKey: vi.fn() }));
const loader = vi.hoisted(() => ({ loadNameSourceConnections: vi.fn() }));
const probe = vi.hoisted(() => ({ testNameSourceConnection: vi.fn() }));

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/name-check/source-connections', () => dbAccess);
vi.mock('$lib/server/admin', () => admin);
vi.mock('$lib/server/security', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/security')>()),
	getEncryptionKey: security.getEncryptionKey,
}));
vi.mock('./index', () => loader);
vi.mock('./connection-test', async (importOriginal) => ({
	...(await importOriginal<typeof import('./connection-test')>()),
	testNameSourceConnection: probe.testNameSourceConnection,
}));

const { EncryptionError } = await import('$lib/server/security');
const { removeNameSourceConnectionSecret, runNameSourceConnectionTest, saveNameSourceConnectionSettings } =
	await import('./connection-settings');

const actor = { actorId: 'admin-1', actorEmail: 'admin@example.test', ipAddress: '127.0.0.1' };

function entry(overrides: Partial<NameSourceConnection> & { vendor: NameSourceConnection['vendor'] }) {
	return {
		name: overrides.vendor,
		enabled: true,
		keyStatus: 'ready' as const,
		configured: true,
		clientId: null,
		apiBase: null,
		tokenUrl: null,
		version: 2,
		updatedAt: null,
		updatedBy: null,
		...overrides,
	};
}

function connectionsOf(entries: NameSourceConnection[], secrets: Partial<Record<string, string>> = {}) {
	return {
		entries,
		degraded: false,
		credentials: () => ({
			euipo: null,
			tavilyApiKey: secrets.tavily ?? null,
			braveApiKey: secrets.brave ?? null,
		}),
		secretOf: (vendor) => secrets[vendor] ?? null,
	} satisfies NameSourceConnections;
}

beforeEach(() => {
	vi.clearAllMocks();
	security.getEncryptionKey.mockReturnValue(KEY);
	admin.recordAuditEvent.mockResolvedValue(undefined);
	loader.loadNameSourceConnections.mockResolvedValue(
		connectionsOf(
			[
				entry({ vendor: 'euipo', clientId: 'app-1' }),
				entry({ vendor: 'tavily' }),
				entry({ vendor: 'brave', keyStatus: 'none' }),
			],
			{ euipo: 'saved-euipo-secret', tavily: 'saved-tavily-key' },
		),
	);
});

describe('saveNameSourceConnectionSettings', () => {
	it('seals the secret before it reaches the database and keeps it out of the audit detail', async () => {
		dbAccess.saveNameSourceConnection.mockResolvedValue({ ok: true, version: 3 });
		const result = await saveNameSourceConnectionSettings(
			{ vendor: 'tavily', enabled: true, secret: PLAINTEXT, expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: true, version: 3, auditRecorded: true });

		const write = dbAccess.saveNameSourceConnection.mock.calls[0]?.[1];
		expect(write.secretCiphertext).toBeDefined();
		expect(write.secretCiphertext).not.toContain(PLAINTEXT);
		expect(write).toMatchObject({ clientId: null, apiBase: null, tokenUrl: null, updatedBy: 'admin-1' });

		const audit = admin.recordAuditEvent.mock.calls[0]?.[0];
		expect(audit).toMatchObject({
			action: 'name_check.source.save',
			targetType: 'name_source_connection',
			targetId: 'tavily',
			detail: { version: 3, keyChange: 'replaced', changedFields: ['secret'] },
		});
		expect(JSON.stringify(audit)).not.toContain(PLAINTEXT);
	});

	it('keeps the stored secret when the form sends none and records which fields moved', async () => {
		dbAccess.saveNameSourceConnection.mockResolvedValue({ ok: true, version: 3 });
		await saveNameSourceConnectionSettings(
			{ vendor: 'euipo', enabled: false, clientId: 'app-2', apiBase: '', expectedVersion: 2 },
			actor,
		);
		const write = dbAccess.saveNameSourceConnection.mock.calls[0]?.[1];
		expect(write.secretCiphertext).toBeUndefined();
		expect(write).toMatchObject({ clientId: 'app-2', apiBase: null, tokenUrl: null });
		expect(admin.recordAuditEvent.mock.calls[0]?.[0].detail).toMatchObject({
			keyChange: 'kept',
			changedFields: ['enabled', 'clientId'],
		});
	});

	it('drops EUIPO-only fields for other vendors before the write', async () => {
		dbAccess.saveNameSourceConnection.mockResolvedValue({ ok: true, version: 1 });
		await saveNameSourceConnectionSettings(
			{ vendor: 'brave', enabled: true, clientId: 'stray', apiBase: 'https://stray', expectedVersion: 0 },
			actor,
		);
		expect(dbAccess.saveNameSourceConnection.mock.calls[0]?.[1]).toMatchObject({
			clientId: null,
			apiBase: null,
			tokenUrl: null,
		});
	});

	it('reports a missing encryption key without writing', async () => {
		security.getEncryptionKey.mockImplementation(() => {
			throw new EncryptionError('invalid_key', 'missing');
		});
		const result = await saveNameSourceConnectionSettings(
			{ vendor: 'tavily', enabled: true, secret: PLAINTEXT, expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: false, rejected: 'encryption_unconfigured' });
		expect(dbAccess.saveNameSourceConnection).not.toHaveBeenCalled();
	});

	it('maps a stale version and a constraint violation onto the form vocabulary', async () => {
		dbAccess.saveNameSourceConnection.mockResolvedValue({ conflict: true });
		expect(
			await saveNameSourceConnectionSettings({ vendor: 'tavily', enabled: true, expectedVersion: 1 }, actor),
		).toEqual({ ok: false, rejected: 'conflict' });

		dbAccess.saveNameSourceConnection.mockRejectedValue(Object.assign(new Error('check'), { code: '23514' }));
		expect(
			await saveNameSourceConnectionSettings(
				{ vendor: 'euipo', enabled: true, clientId: 'x', apiBase: 'http://plain', expectedVersion: 2 },
				actor,
			),
		).toEqual({ ok: false, rejected: 'invalid_fields' });
		expect(admin.recordAuditEvent).not.toHaveBeenCalled();
	});

	it('still reports the change when the audit write fails', async () => {
		dbAccess.saveNameSourceConnection.mockResolvedValue({ ok: true, version: 3 });
		admin.recordAuditEvent.mockRejectedValue(new Error('audit down'));
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await saveNameSourceConnectionSettings(
			{ vendor: 'tavily', enabled: true, expectedVersion: 2 },
			actor,
		);
		expect(result).toEqual({ ok: true, version: 3, auditRecorded: false });
		spy.mockRestore();
	});
});

describe('removeNameSourceConnectionSecret', () => {
	it('refuses when nothing is stored and clears otherwise', async () => {
		expect(await removeNameSourceConnectionSecret({ vendor: 'brave', expectedVersion: 2 }, actor)).toEqual({
			ok: false,
			rejected: 'no_secret',
		});

		dbAccess.removeNameSourceSecret.mockResolvedValue({ ok: true, version: 3 });
		expect(await removeNameSourceConnectionSecret({ vendor: 'tavily', expectedVersion: 2 }, actor)).toEqual({
			ok: true,
			version: 3,
			auditRecorded: true,
		});
		expect(admin.recordAuditEvent.mock.calls[0]?.[0]).toMatchObject({
			action: 'name_check.source.secret.remove',
			detail: { version: 3, keyChange: 'removed' },
		});
	});
});

describe('runNameSourceConnectionTest', () => {
	it('tests the draft secret when one is typed and the saved one otherwise, without writing', async () => {
		probe.testNameSourceConnection.mockResolvedValue({ outcome: 'ok', latencyMs: 12, testedAt: 't' });

		const draft = await runNameSourceConnectionTest({ vendor: 'tavily', draftSecret: PLAINTEXT }, actor);
		expect(draft).toMatchObject({ ok: true, test: { outcome: 'ok', target: 'draft', version: 2, vendor: 'tavily' } });
		expect(probe.testNameSourceConnection.mock.calls[0]?.[1]).toEqual({
			euipo: null,
			tavilyApiKey: PLAINTEXT,
			braveApiKey: null,
		});

		const saved = await runNameSourceConnectionTest({ vendor: 'tavily' }, actor);
		expect(saved).toMatchObject({ ok: true, test: { target: 'saved' } });
		expect(probe.testNameSourceConnection.mock.calls[1]?.[1]).toMatchObject({ tavilyApiKey: 'saved-tavily-key' });

		expect(dbAccess.saveNameSourceConnection).not.toHaveBeenCalled();
		const audit = admin.recordAuditEvent.mock.calls[0]?.[0];
		expect(audit).toMatchObject({ action: 'name_check.source.test', detail: { outcome: 'ok', target: 'draft' } });
		expect(JSON.stringify(audit)).not.toContain(PLAINTEXT);
	});

	it('builds EUIPO credentials from the form fields over the saved secret', async () => {
		probe.testNameSourceConnection.mockResolvedValue({ outcome: 'ok', latencyMs: 12, testedAt: 't' });
		const result = await runNameSourceConnectionTest(
			{ vendor: 'euipo', clientId: 'app-1', apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search' },
			actor,
		);
		expect(result).toMatchObject({ ok: true, test: { target: 'draft' } });
		expect(probe.testNameSourceConnection.mock.calls[0]?.[1].euipo).toMatchObject({
			clientId: 'app-1',
			clientSecret: 'saved-euipo-secret',
			apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
		});
	});

	it('refuses to test with nothing to test', async () => {
		expect(await runNameSourceConnectionTest({ vendor: 'brave' }, actor)).toEqual({ ok: false, rejected: 'no_secret' });
		expect(await runNameSourceConnectionTest({ vendor: 'euipo', draftSecret: 's' }, actor)).toEqual({
			ok: false,
			rejected: 'no_secret',
		});
		expect(probe.testNameSourceConnection).not.toHaveBeenCalled();
	});
});
