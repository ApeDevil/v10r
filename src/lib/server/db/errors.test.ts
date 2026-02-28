import { describe, it, expect } from 'vitest';
import { DbError, classifyDbError, safeDbMessage } from './errors';
import { ServerError } from '$lib/server/errors';

describe('DbError', () => {
	it('extends ServerError', () => {
		const err = new DbError('connection', 'fail');
		expect(err).toBeInstanceOf(ServerError);
		expect(err).toBeInstanceOf(DbError);
		expect(err.name).toBe('DbError');
	});

	it.each([
		['connection', 503],
		['constraint', 409],
		['not_found', 404],
		['timeout', 504],
		['serialization', 409],
		['permission', 502],
		['unknown', 500],
	] as const)('toStatus() maps %s → %d', (kind, expected) => {
		expect(new DbError(kind, 'msg').toStatus()).toBe(expected);
	});
});

describe('classifyDbError', () => {
	it('passes through existing DbError instances', () => {
		const original = new DbError('timeout', 'already classified');
		expect(classifyDbError(original)).toBe(original);
	});

	it.each([
		['23505', 'constraint'],
		['23503', 'constraint'],
		['08001', 'connection'],
		['08006', 'connection'],
		['40001', 'serialization'],
		['40P01', 'serialization'],
		['57014', 'timeout'],
		['42501', 'permission'],
		['28000', 'permission'],
		['28P01', 'permission'],
		['99999', 'unknown'],
	] as const)('classifies PG code %s → %s', (code, expectedKind) => {
		const err = classifyDbError({ code, message: 'pg error' });
		expect(err.kind).toBe(expectedKind);
		expect(err.code).toBe(code);
	});

	it.each([
		['Connection timeout exceeded', 'timeout'],
		['ETIMEDOUT', 'timeout'],
		['fetch failed', 'connection'],
		['ECONNREFUSED', 'connection'],
	])('classifies message "%s" → %s', (message, expectedKind) => {
		const err = classifyDbError(new Error(message));
		expect(err.kind).toBe(expectedKind);
	});

	it('falls back to unknown for unrecognized errors', () => {
		const err = classifyDbError(new Error('something weird'));
		expect(err.kind).toBe('unknown');
	});

	it('handles non-Error values', () => {
		const err = classifyDbError('string error');
		expect(err.kind).toBe('unknown');
		expect(err.message).toBe('Unknown database error');
	});
});

describe('safeDbMessage', () => {
	it.each([
		'connection',
		'constraint',
		'not_found',
		'timeout',
		'serialization',
		'permission',
		'unknown',
	] as const)('returns a user-safe string for %s', (kind) => {
		const msg = safeDbMessage(kind);
		expect(msg).toBeTruthy();
		expect(msg).not.toContain('schema');
		expect(msg).not.toContain('table');
		expect(msg).not.toContain('column');
	});
});
