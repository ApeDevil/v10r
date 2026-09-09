import { describe, expect, it } from 'vitest';
import { AiError, aiErrorToStatus, classifyAiError, safeAiMessage } from './errors';

/**
 * The provider-error classifier.
 *
 * `classifyAiError` is one status-then-substring chain and `aiErrorToStatus` is a lookup
 * table, so both are tested AS tables — the old shape restated each branch as its own
 * `it()`, which made the two cases that carry real information (the status-over-message
 * priority, and the fact that nothing leaks a credential) indistinguishable from the
 * eighteen that restate a `String.includes`.
 *
 * The substring rules are deliberately lax — a message merely containing 'rate' or
 * 'token' is enough. That laxity is why `chat-orchestrator.test.ts` asserts a DbError is
 * never routed through here: a database failure mentioning 'token' must not be laundered
 * into an AI rate-limit and trip a provider cooldown.
 */

describe('classifyAiError', () => {
	it('passes an existing AiError through unchanged', () => {
		const original = new AiError('rate_limit', 'slow down', '429');
		expect(classifyAiError(original)).toBe(original);
	});

	it.each([
		{ label: 'status 401', input: { status: 401, message: 'bad key' }, kind: 'authentication', code: '401' },
		{ label: 'status 403', input: { status: 403, message: 'forbidden' }, kind: 'authentication' },
		{ label: 'status 429', input: { status: 429, message: 'too many' }, kind: 'rate_limit', code: '429' },
		{ label: 'status 404', input: { status: 404, message: 'not found' }, kind: 'model' },
		{ label: 'code rate_limit_exceeded', input: { code: 'rate_limit_exceeded', message: 'x' }, kind: 'rate_limit' },
	])('classifies $label as $kind', ({ input, kind, code }) => {
		const result = classifyAiError(input);
		expect(result.kind).toBe(kind);
		if (code) expect(result.code).toBe(code);
	});

	it.each([
		{ message: 'authentication failed', kind: 'authentication' },
		{ message: 'rate limit exceeded', kind: 'rate_limit' },
		{ message: 'model not available', kind: 'model' },
		{ message: 'context length exceeded', kind: 'context_length', code: 'CONTEXT_LENGTH' },
		{ message: 'maximum token limit reached', kind: 'context_length' },
		{ message: 'request timeout', kind: 'timeout', code: 'TIMEOUT' },
		{ message: 'connect ETIMEDOUT', kind: 'timeout' },
		{ message: 'fetch failed', kind: 'unavailable', code: 'NETWORK' },
		{ message: 'connect ECONNREFUSED', kind: 'unavailable' },
		{ message: 'something weird happened', kind: 'unknown' },
	])('classifies message "$message" as $kind', ({ message, kind, code }) => {
		const result = classifyAiError(new Error(message));
		expect(result.kind).toBe(kind);
		if (code) expect(result.code).toBe(code);
	});

	/** Status is checked before the message, so a 429 wins over the word "model". */
	it('prioritises status over message when the two disagree', () => {
		expect(classifyAiError({ status: 429, message: 'model rate limited' }).kind).toBe('rate_limit');
	});

	it('degrades non-Error values to unknown rather than throwing', () => {
		expect(classifyAiError('string error')).toMatchObject({ kind: 'unknown', message: 'Unknown AI error' });
		expect(classifyAiError(null).kind).toBe('unknown');
		expect(classifyAiError(undefined).kind).toBe('unknown');
	});

	it('preserves the original message and any caller code', () => {
		expect(classifyAiError(new Error('connect ECONNREFUSED 10.0.0.1:443')).message).toBe(
			'connect ECONNREFUSED 10.0.0.1:443',
		);
		expect(classifyAiError({ message: 'weird', code: 'CUSTOM_CODE' })).toMatchObject({
			kind: 'unknown',
			code: 'CUSTOM_CODE',
		});
	});
});

const KINDS = ['authentication', 'rate_limit', 'model', 'context_length', 'timeout', 'unavailable', 'unknown'] as const;

describe('safeAiMessage', () => {
	it('gives every kind a non-empty message that names no credential', () => {
		for (const kind of KINDS) {
			const msg = safeAiMessage(kind);
			expect(msg, kind).toBeTruthy();
			expect(msg, kind).not.toMatch(/api[_-]?key|secret|token/i);
		}
	});
});

describe('aiErrorToStatus', () => {
	it.each([
		{ kind: 'authentication', status: 502 },
		{ kind: 'rate_limit', status: 429 },
		{ kind: 'model', status: 502 },
		{ kind: 'context_length', status: 400 },
		{ kind: 'timeout', status: 504 },
		{ kind: 'unavailable', status: 503 },
		{ kind: 'unknown', status: 500 },
	] as const)('maps $kind to $status', ({ kind, status }) => {
		expect(aiErrorToStatus(kind)).toBe(status);
	});

	it('covers every kind safeAiMessage knows about', () => {
		// Guards the two tables above from drifting apart when a kind is added.
		for (const kind of KINDS) expect(typeof aiErrorToStatus(kind)).toBe('number');
	});
});
