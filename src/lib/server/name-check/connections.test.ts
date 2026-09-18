import { describe, expect, it } from 'vitest';
import type { NameSourceConnectionRow } from '$lib/server/db/schema/name-check/source-connection';
import { encryptAesGcm } from '$lib/server/security';
import { publicNameSourceConnection, resolveNameSourceConnections } from './connections';
import { EUIPO_DEFAULT_API_BASE, EUIPO_DEFAULT_TOKEN_URL } from './sources/euipo';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const OTHER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

function row(overrides: Partial<NameSourceConnectionRow> & { vendor: NameSourceConnectionRow['vendor'] }) {
	return {
		enabled: true,
		clientId: null,
		secretCiphertext: null,
		apiBase: null,
		tokenUrl: null,
		version: 1,
		updatedAt: new Date('2026-09-17T06:00:00Z'),
		updatedBy: 'admin-1',
		...overrides,
	} satisfies NameSourceConnectionRow;
}

describe('resolveNameSourceConnections', () => {
	it('lists every vendor, unconfigured at version 0 when no row exists', async () => {
		const { entries, degraded, credentials } = await resolveNameSourceConnections([], KEY);
		expect(entries.map((e) => e.vendor)).toEqual(['euipo', 'tavily', 'brave']);
		expect(entries.every((e) => e.version === 0 && e.keyStatus === 'none' && !e.configured)).toBe(true);
		expect(degraded).toBe(false);
		expect(credentials()).toEqual({ euipo: null, tavilyApiKey: null, braveApiKey: null });
	});

	it('opens the secret only into the closure and only for a configured vendor', async () => {
		const rows = [
			row({ vendor: 'tavily', secretCiphertext: await encryptAesGcm('tvly-live', KEY) }),
			row({ vendor: 'brave', enabled: false, secretCiphertext: await encryptAesGcm('brave-off', KEY) }),
		];
		const connections = await resolveNameSourceConnections(rows, KEY);
		const tavily = connections.entries.find((e) => e.vendor === 'tavily');
		const brave = connections.entries.find((e) => e.vendor === 'brave');
		expect(tavily).toMatchObject({ keyStatus: 'ready', configured: true, version: 1 });
		expect(brave).toMatchObject({ keyStatus: 'ready', configured: false, enabled: false });
		expect(connections.credentials()).toEqual({ euipo: null, tavilyApiKey: 'tvly-live', braveApiKey: null });
		expect(connections.secretOf('brave')).toBe('brave-off');
		expect(JSON.stringify(connections.entries)).not.toContain('tvly-live');
	});

	it('needs a client id beside the secret before EUIPO counts as configured, and fills in the default hosts', async () => {
		const secret = await encryptAesGcm('euipo-secret', KEY);
		const without = await resolveNameSourceConnections([row({ vendor: 'euipo', secretCiphertext: secret })], KEY);
		expect(without.entries[0]).toMatchObject({ keyStatus: 'ready', configured: false });
		expect(without.credentials().euipo).toBeNull();

		const withId = await resolveNameSourceConnections(
			[row({ vendor: 'euipo', clientId: 'app-1', secretCiphertext: secret })],
			KEY,
		);
		expect(withId.credentials().euipo).toEqual({
			clientId: 'app-1',
			clientSecret: 'euipo-secret',
			apiBase: EUIPO_DEFAULT_API_BASE,
			tokenUrl: EUIPO_DEFAULT_TOKEN_URL,
		});

		const custom = await resolveNameSourceConnections(
			[
				row({
					vendor: 'euipo',
					clientId: 'app-1',
					secretCiphertext: secret,
					apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
					tokenUrl: 'https://auth-sandbox.euipo.europa.eu/oidc/accessToken',
				}),
			],
			KEY,
		);
		expect(custom.credentials().euipo).toMatchObject({
			apiBase: 'https://api-sandbox.euipo.europa.eu/trademark-search',
			tokenUrl: 'https://auth-sandbox.euipo.europa.eu/oidc/accessToken',
		});
	});

	it('marks a secret the current key cannot open as undecryptable and the set as degraded', async () => {
		const rows = [row({ vendor: 'tavily', secretCiphertext: await encryptAesGcm('tvly-old', OTHER_KEY) })];
		const withWrongKey = await resolveNameSourceConnections(rows, KEY);
		expect(withWrongKey.entries.find((e) => e.vendor === 'tavily')).toMatchObject({
			keyStatus: 'undecryptable',
			configured: false,
		});
		expect(withWrongKey.degraded).toBe(true);
		expect(withWrongKey.credentials().tavilyApiKey).toBeNull();

		const withNoKey = await resolveNameSourceConnections(rows, null);
		expect(withNoKey.degraded).toBe(true);
	});
});

describe('publicNameSourceConnection', () => {
	it('carries no secret, ciphertext or closure', async () => {
		const rows = [row({ vendor: 'tavily', secretCiphertext: await encryptAesGcm('tvly-live', KEY) })];
		const { entries } = await resolveNameSourceConnections(rows, KEY);
		const projected = publicNameSourceConnection(entries.find((e) => e.vendor === 'tavily') as never);
		expect(projected).toEqual({
			vendor: 'tavily',
			name: 'Tavily',
			enabled: true,
			hasSecret: true,
			keyStatus: 'ready',
			configured: true,
			clientId: null,
			apiBase: null,
			tokenUrl: null,
			version: 1,
			updatedAt: '2026-09-17T06:00:00.000Z',
			updatedBy: 'admin-1',
		});
		const wire = JSON.stringify(projected);
		expect(wire).not.toContain('tvly-live');
		expect(wire).not.toMatch(/iphertext/);
	});
});
