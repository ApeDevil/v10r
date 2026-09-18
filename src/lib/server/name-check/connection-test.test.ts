import { describe, expect, it } from 'vitest';
import { credentialsForVendor, testNameSourceConnection } from './connection-test';
import { NameSourceError } from './errors';
import { type NameSource, NO_CREDENTIALS } from './name-source';

const TAVILY = { ...NO_CREDENTIALS, tavilyApiKey: 'tvly-key' };
const EUIPO = {
	clientId: 'client',
	clientSecret: 'secret',
	apiBase: 'https://api.example.test',
	tokenUrl: 'https://auth.example.test/token',
};

function sourceThat(search: NameSource['search']): NameSource {
	return { id: 'web', kind: 'web', territories: ['eu'], manualUrl: () => 'https://example.test', search };
}

describe('testNameSourceConnection', () => {
	it('reports ok with a latency when the probe search resolves', async () => {
		const result = await testNameSourceConnection('tavily', TAVILY, { source: sourceThat(async () => []) });
		expect(result.outcome).toBe('ok');
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
		expect(result.testedAt).toMatch(/^\d{4}-/);
	});

	it('reads invalid credentials off the HTTP status the fetch helper recorded', async () => {
		for (const status of [400, 401, 403]) {
			const result = await testNameSourceConnection('tavily', TAVILY, {
				source: sourceThat(async () => {
					throw new NameSourceError('unavailable', `HTTP ${status}`);
				}),
			});
			expect(result.outcome).toBe('invalid_credentials');
			expect(result.detail).toBe(`HTTP ${status}`);
		}
	});

	it('keeps the step a source named in front of the status, as the detail', async () => {
		const result = await testNameSourceConnection(
			'euipo',
			{ ...NO_CREDENTIALS, euipo: EUIPO },
			{
				source: sourceThat(async () => {
					throw new NameSourceError('unavailable', 'token endpoint: HTTP 401');
				}),
			},
		);
		expect(result.outcome).toBe('invalid_credentials');
		expect(result.detail).toBe('token endpoint: HTTP 401');
	});

	it('carries no detail on success', async () => {
		const result = await testNameSourceConnection('tavily', TAVILY, { source: sourceThat(async () => []) });
		expect(result.detail).toBeUndefined();
	});

	it('keeps a wrong host apart from a wrong password', async () => {
		const result = await testNameSourceConnection('tavily', TAVILY, {
			source: sourceThat(async () => {
				throw new NameSourceError('unavailable', 'HTTP 404');
			}),
		});
		expect(result.outcome).toBe('unavailable');
	});

	it('classifies rate limits, timeouts and unknown failures', async () => {
		const limited = await testNameSourceConnection('tavily', TAVILY, {
			source: sourceThat(async () => {
				throw new NameSourceError('rate_limited', 'back off', 30);
			}),
		});
		expect(limited.outcome).toBe('rate_limited');

		const aborted = await testNameSourceConnection('tavily', TAVILY, {
			source: sourceThat(async () => {
				throw new DOMException('aborted', 'AbortError');
			}),
		});
		expect(aborted.outcome).toBe('timeout');

		const unknown = await testNameSourceConnection('tavily', TAVILY, {
			source: sourceThat(async () => {
				throw new TypeError('shape changed');
			}),
		});
		expect(unknown.outcome).toBe('unknown');
	});

	it('hands the source only the vendor under test', async () => {
		let seen: unknown;
		await testNameSourceConnection(
			'brave',
			{ euipo: null, tavilyApiKey: 'tvly-key', braveApiKey: 'brave-key' },
			{
				source: sourceThat(async (_query, ctx) => {
					seen = ctx.credentials;
					return [];
				}),
			},
		);
		expect(seen).toEqual({ euipo: null, tavilyApiKey: null, braveApiKey: 'brave-key' });
	});
});

describe('credentialsForVendor', () => {
	it('isolates each vendor', () => {
		const all = {
			euipo: { clientId: 'a', clientSecret: 'b', apiBase: 'https://x', tokenUrl: 'https://y' },
			tavilyApiKey: 't',
			braveApiKey: 'br',
		};
		expect(credentialsForVendor('euipo', all)).toEqual({ ...NO_CREDENTIALS, euipo: all.euipo });
		expect(credentialsForVendor('tavily', all)).toEqual({ ...NO_CREDENTIALS, tavilyApiKey: 't' });
		expect(credentialsForVendor('brave', all)).toEqual({ ...NO_CREDENTIALS, braveApiKey: 'br' });
	});
});
