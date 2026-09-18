import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NameSourceConnection, NameSourceConnections } from '$lib/server/name-check/connections';

const ADMIN = { user: { id: 'admin-1', email: 'admin@example.test' }, session: {} };
const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const nameCheck = vi.hoisted(() => ({ loadNameSourceConnections: vi.fn() }));
const settings = vi.hoisted(() => ({
	saveNameSourceConnectionSettings: vi.fn(),
	removeNameSourceConnectionSecret: vi.fn(),
	runNameSourceConnectionTest: vi.fn(),
}));
const limiter = vi.hoisted(() => ({ limit: vi.fn(async () => ({ success: true, reset: 0 })) }));
const security = vi.hoisted(() => ({ getEncryptionKey: vi.fn(() => 'k') }));

vi.mock('$lib/server/http/guards', () => guards);
vi.mock('$lib/server/name-check', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/name-check')>()),
	loadNameSourceConnections: nameCheck.loadNameSourceConnections,
}));
vi.mock('$lib/server/name-check/connection-settings', () => settings);
vi.mock('$lib/server/http/rate-limit', () => ({ createLimiter: () => limiter }));
vi.mock('$lib/server/security', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/security')>()),
	getEncryptionKey: security.getEncryptionKey,
}));
vi.mock('$lib/server/db', () => ({ db: {} }));

const { actions, load } = await import('./+page.server');

const PLAINTEXT = 'tvly-live-should-never-echo';
const CIPHERTEXT = 'bm9uY2U=:Y2lwaGVy';
const ACTOR = { actorId: 'admin-1', actorEmail: 'admin@example.test', ipAddress: '127.0.0.1' };

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
		updatedAt: new Date('2026-09-17T06:00:00Z'),
		updatedBy: 'admin-1',
		...overrides,
	};
}

function connectionsOf(...entries: NameSourceConnection[]) {
	return {
		entries,
		degraded: false,
		credentials: () => ({ euipo: null, tavilyApiKey: PLAINTEXT, braveApiKey: null }),
		secretOf: () => PLAINTEXT,
	} satisfies NameSourceConnections;
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
	limiter.limit.mockResolvedValue({ success: true, reset: 0 });
	nameCheck.loadNameSourceConnections.mockResolvedValue(
		connectionsOf(
			entry({ vendor: 'euipo', clientId: 'app-1' }),
			entry({ vendor: 'tavily' }),
			entry({ vendor: 'brave', keyStatus: 'none', configured: false }),
		),
	);
});

describe('/admin/name-check load', () => {
	it('requires admin and ships only the public projection plus resolved labels', async () => {
		const data = (await load(loadEvent())) as {
			connections: unknown[];
			unavailable: boolean;
			labels: { copy: Record<string, string> };
		};
		expect(guards.requireAdmin).toHaveBeenCalled();
		expect(data.unavailable).toBe(false);
		expect(data.connections).toHaveLength(3);
		expect(data.labels.copy.save).toBeTypeOf('string');
		const serialized = JSON.stringify(data.connections);
		expect(serialized).not.toContain('secretOf');
		expect(serialized).not.toContain(PLAINTEXT);
		expect(serialized).not.toContain(CIPHERTEXT);
		expect(serialized).not.toMatch(/iphertext/);
		expect(Object.keys(data)).not.toContain('credentials');
	});

	it('renders the setup page when the settings table cannot be read', async () => {
		nameCheck.loadNameSourceConnections.mockRejectedValue(
			new Error('relation "name_check.source_connection" does not exist'),
		);
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

describe('/admin/name-check actions', () => {
	it('every action requires admin', async () => {
		guards.requireAdmin.mockImplementation(() => {
			throw new Error('Not Found');
		});
		for (const action of ['save', 'test', 'removeSecret'] as const) {
			await expect(actions[action]?.(formEvent({}))).rejects.toThrow(/Not Found/);
		}
		expect(settings.saveNameSourceConnectionSettings).not.toHaveBeenCalled();
	});

	it('save hands the secret to the domain with the audit actor and never echoes it back', async () => {
		settings.saveNameSourceConnectionSettings.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		const result = await actions.save?.(
			formEvent({ vendor: 'tavily', enabled: 'true', secret: PLAINTEXT, version: '2' }),
		);
		expect(settings.saveNameSourceConnectionSettings).toHaveBeenCalledWith(
			{
				vendor: 'tavily',
				enabled: true,
				clientId: undefined,
				apiBase: undefined,
				tokenUrl: undefined,
				secret: PLAINTEXT,
				expectedVersion: 2,
			},
			ACTOR,
		);
		expect(JSON.stringify(result)).not.toContain(PLAINTEXT);
		expect(result).toMatchObject({ saved: { vendor: 'tavily', version: 3 } });
	});

	it('save treats an empty secret field as "keep" and passes EUIPO hosts through', async () => {
		settings.saveNameSourceConnectionSettings.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		await actions.save?.(
			formEvent({
				vendor: 'euipo',
				enabled: 'false',
				clientId: 'app-1',
				secret: '',
				apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
				tokenUrl: '',
				version: '2',
			}),
		);
		expect(settings.saveNameSourceConnectionSettings.mock.calls[0]?.[0]).toMatchObject({
			vendor: 'euipo',
			enabled: false,
			clientId: 'app-1',
			secret: undefined,
			apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
			tokenUrl: '',
		});
	});

	it('save rejects a plain-http host before the domain sees it, without echoing the secret', async () => {
		const result = (await actions.save?.(
			formEvent({ vendor: 'euipo', enabled: 'true', secret: PLAINTEXT, apiBase: 'http://plain', version: '2' }),
		)) as { status: number; data: { message: string } };
		expect(result.status).toBe(400);
		expect(result.data.message).toMatch(/https/);
		expect(JSON.stringify(result)).not.toContain(PLAINTEXT);
		expect(settings.saveNameSourceConnectionSettings).not.toHaveBeenCalled();
	});

	it('maps domain rejections onto statuses', async () => {
		const cases: Array<[string, number]> = [
			['conflict', 409],
			['encryption_unconfigured', 500],
			['no_secret', 400],
			['invalid_fields', 400],
		];
		for (const [rejected, status] of cases) {
			settings.saveNameSourceConnectionSettings.mockResolvedValue({ ok: false, rejected });
			const result = (await actions.save?.(formEvent({ vendor: 'tavily', enabled: 'true', version: '2' }))) as {
				status: number;
			};
			expect(result.status).toBe(status);
		}
	});

	it('test is rate-limited per admin and returns the classified outcome only', async () => {
		settings.runNameSourceConnectionTest.mockResolvedValue({
			ok: true,
			test: { vendor: 'tavily', outcome: 'ok', latencyMs: 40, testedAt: 't', target: 'draft', version: 2 },
			auditRecorded: true,
		});
		const result = await actions.test?.(formEvent({ vendor: 'tavily', secret: PLAINTEXT }));
		expect(limiter.limit).toHaveBeenCalledWith('admin-1');
		expect(settings.runNameSourceConnectionTest).toHaveBeenCalledWith(
			{ vendor: 'tavily', clientId: undefined, apiBase: undefined, tokenUrl: undefined, draftSecret: PLAINTEXT },
			ACTOR,
		);
		expect(result).toMatchObject({ test: { outcome: 'ok', target: 'draft' } });
		expect(JSON.stringify(result)).not.toContain(PLAINTEXT);

		limiter.limit.mockResolvedValue({ success: false, reset: 0 });
		const limited = (await actions.test?.(formEvent({ vendor: 'tavily' }))) as { status: number };
		expect(limited.status).toBe(429);
	});

	it('removeSecret forwards the version and reports the domain result', async () => {
		settings.removeNameSourceConnectionSecret.mockResolvedValue({ ok: true, version: 3, auditRecorded: true });
		const result = await actions.removeSecret?.(formEvent({ vendor: 'tavily', version: '2' }));
		expect(settings.removeNameSourceConnectionSecret).toHaveBeenCalledWith(
			{ vendor: 'tavily', expectedVersion: 2 },
			ACTOR,
		);
		expect(result).toMatchObject({ saved: { vendor: 'tavily', version: 3 } });
	});
});
