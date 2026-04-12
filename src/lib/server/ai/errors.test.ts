import { describe, expect, it } from 'vitest';
import { AIError, aiErrorToStatus, classifyAIError, safeAIMessage } from './errors';

describe('classifyAIError', () => {
	it('passes through existing AIError unchanged', () => {
		const original = new AIError('rate_limit', 'slow down', '429');
		const result = classifyAIError(original);
		expect(result).toBe(original);
	});

	it('classifies status 401 as authentication', () => {
		const result = classifyAIError({ status: 401, message: 'bad key' });
		expect(result.kind).toBe('authentication');
		expect(result.code).toBe('401');
	});

	it('classifies status 403 as authentication', () => {
		const result = classifyAIError({ status: 403, message: 'forbidden' });
		expect(result.kind).toBe('authentication');
	});

	it('classifies "authentication" in message as authentication', () => {
		const result = classifyAIError(new Error('authentication failed'));
		expect(result.kind).toBe('authentication');
	});

	it('classifies status 429 as rate_limit', () => {
		const result = classifyAIError({ status: 429, message: 'too many' });
		expect(result.kind).toBe('rate_limit');
		expect(result.code).toBe('429');
	});

	it('classifies "rate" in message as rate_limit', () => {
		const result = classifyAIError(new Error('rate limit exceeded'));
		expect(result.kind).toBe('rate_limit');
	});

	it('classifies code "rate_limit_exceeded" as rate_limit', () => {
		const result = classifyAIError({ code: 'rate_limit_exceeded', message: 'slow down' });
		expect(result.kind).toBe('rate_limit');
	});

	it('classifies status 404 as model', () => {
		const result = classifyAIError({ status: 404, message: 'not found' });
		expect(result.kind).toBe('model');
	});

	it('classifies "model" in message as model', () => {
		const result = classifyAIError(new Error('model not available'));
		expect(result.kind).toBe('model');
	});

	it('classifies "context length" in message as context_length', () => {
		const result = classifyAIError(new Error('context length exceeded'));
		expect(result.kind).toBe('context_length');
		expect(result.code).toBe('CONTEXT_LENGTH');
	});

	it('classifies "token" in message as context_length', () => {
		const result = classifyAIError(new Error('maximum token limit reached'));
		expect(result.kind).toBe('context_length');
	});

	it('classifies "timeout" in message as timeout', () => {
		const result = classifyAIError(new Error('request timeout'));
		expect(result.kind).toBe('timeout');
		expect(result.code).toBe('TIMEOUT');
	});

	it('classifies "ETIMEDOUT" in message as timeout', () => {
		const result = classifyAIError(new Error('connect ETIMEDOUT'));
		expect(result.kind).toBe('timeout');
	});

	it('classifies "fetch failed" in message as unavailable', () => {
		const result = classifyAIError(new Error('fetch failed'));
		expect(result.kind).toBe('unavailable');
		expect(result.code).toBe('NETWORK');
	});

	it('classifies "ECONNREFUSED" in message as unavailable', () => {
		const result = classifyAIError(new Error('connect ECONNREFUSED'));
		expect(result.kind).toBe('unavailable');
	});

	it('classifies unknown errors as unknown', () => {
		const result = classifyAIError(new Error('something weird happened'));
		expect(result.kind).toBe('unknown');
	});

	it('handles non-Error values', () => {
		const result = classifyAIError('string error');
		expect(result.kind).toBe('unknown');
		expect(result.message).toBe('Unknown AI error');
	});

	it('handles null/undefined', () => {
		expect(classifyAIError(null).kind).toBe('unknown');
		expect(classifyAIError(undefined).kind).toBe('unknown');
	});

	it('preserves original error message', () => {
		const result = classifyAIError(new Error('connect ECONNREFUSED 10.0.0.1:443'));
		expect(result.message).toBe('connect ECONNREFUSED 10.0.0.1:443');
	});

	it('preserves code from unknown errors', () => {
		const result = classifyAIError({ message: 'weird', code: 'CUSTOM_CODE' });
		expect(result.kind).toBe('unknown');
		expect(result.code).toBe('CUSTOM_CODE');
	});

	// Priority: status checks run before message checks
	it('prioritizes status 429 over "model" in message', () => {
		const result = classifyAIError({ status: 429, message: 'model rate limited' });
		expect(result.kind).toBe('rate_limit');
	});
});

describe('safeAIMessage', () => {
	it('returns user-safe messages for all kinds', () => {
		const kinds = ['authentication', 'rate_limit', 'model', 'context_length', 'timeout', 'unavailable', 'unknown'] as const;
		for (const kind of kinds) {
			const msg = safeAIMessage(kind);
			expect(msg).toBeTruthy();
			// Should not expose provider internals
			expect(msg).not.toMatch(/api[_-]?key|secret|token/i);
		}
	});
});

describe('aiErrorToStatus', () => {
	it('maps authentication → 502', () => expect(aiErrorToStatus('authentication')).toBe(502));
	it('maps rate_limit → 429', () => expect(aiErrorToStatus('rate_limit')).toBe(429));
	it('maps model → 502', () => expect(aiErrorToStatus('model')).toBe(502));
	it('maps context_length → 400', () => expect(aiErrorToStatus('context_length')).toBe(400));
	it('maps timeout → 504', () => expect(aiErrorToStatus('timeout')).toBe(504));
	it('maps unavailable → 503', () => expect(aiErrorToStatus('unavailable')).toBe(503));
	it('maps unknown → 500', () => expect(aiErrorToStatus('unknown')).toBe(500));
});
