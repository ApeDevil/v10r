import { describe, expect, it } from 'vitest';
import { ServerError } from './index';

describe('ServerError', () => {
	it('sets name, kind, message, and code', () => {
		const err = new ServerError('test_kind', 'boom', 'ERR_01');
		expect(err.name).toBe('ServerError');
		expect(err.kind).toBe('test_kind');
		expect(err.message).toBe('boom');
		expect(err.code).toBe('ERR_01');
	});

	it('code is optional', () => {
		const err = new ServerError('test_kind', 'boom');
		expect(err.code).toBeUndefined();
	});

	it('is an instance of Error', () => {
		const err = new ServerError('test_kind', 'boom');
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ServerError);
	});

	it('toStatus() defaults to 500', () => {
		const err = new ServerError('anything', 'msg');
		expect(err.toStatus()).toBe(500);
	});

	it('toJSON() returns structured representation', () => {
		const err = new ServerError('test_kind', 'boom', 'ERR_01');
		expect(err.toJSON()).toEqual({
			name: 'ServerError',
			kind: 'test_kind',
			message: 'boom',
			code: 'ERR_01',
			status: 500,
		});
	});
});
