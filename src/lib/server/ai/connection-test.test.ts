import { APICallError } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('ai')>()),
	generateText: vi.fn(),
}));

const { generateText } = await import('ai');
const { testLanguageModel } = await import('./connection-test');

const model = {} as Parameters<typeof testLanguageModel>[0];

function apiError(statusCode: number | undefined, message = 'provider said no') {
	return new APICallError({ message, url: 'https://provider.example/v1', requestBodyValues: {}, statusCode });
}

// mockRejectedValue builds its rejected promise eagerly, which Vitest reports as unhandled.
function rejectWith(err: unknown) {
	vi.mocked(generateText).mockImplementation(() => Promise.reject(err));
}

describe('testLanguageModel', () => {
	// Braces matter: an arrow returning the mock hands vitest a "cleanup" that calls it.
	beforeEach(() => {
		vi.mocked(generateText).mockReset();
	});

	it('reports ok with timing when the call resolves, whatever the text', async () => {
		vi.mocked(generateText).mockResolvedValue({ text: '' } as never);
		const result = await testLanguageModel(model);
		expect(result.outcome).toBe('ok');
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
		expect(result.testedAt).toMatch(/^\d{4}-/);
		expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({ maxRetries: 0, maxOutputTokens: 16 });
	});

	it.each([
		[401, 'invalid_key'],
		[403, 'invalid_key'],
		[404, 'model_not_found'],
		[429, 'rate_limited'],
		[undefined, 'network'],
	] as const)('classifies an APICallError with status %s as %s', async (statusCode, outcome) => {
		rejectWith(apiError(statusCode));
		expect((await testLanguageModel(model)).outcome).toBe(outcome);
	});

	it('classifies the abort timeout', async () => {
		const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
		rejectWith(timeout);
		expect((await testLanguageModel(model)).outcome).toBe('timeout');
	});

	it('never carries the provider message in the result', async () => {
		rejectWith(apiError(500, 'Invalid API key sk-live-abc123'));
		const result = await testLanguageModel(model);
		expect(Object.keys(result).sort()).toEqual(['latencyMs', 'outcome', 'testedAt']);
		expect(JSON.stringify(result)).not.toContain('sk-live');
	});
});
