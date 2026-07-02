import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAdminUserIds, getSystemAuthorId, isAdminUserId, logAdminConfig, parseAdminIds } from './admin-ids';

const ORIGINAL_ADMIN = process.env.ADMIN_USER_ID;

afterEach(() => {
	if (ORIGINAL_ADMIN === undefined) delete process.env.ADMIN_USER_ID;
	else process.env.ADMIN_USER_ID = ORIGINAL_ADMIN;
	vi.restoreAllMocks();
});

describe('parseAdminIds (pure)', () => {
	it('returns [] for undefined, null, or empty', () => {
		expect(parseAdminIds(undefined)).toEqual([]);
		expect(parseAdminIds(null)).toEqual([]);
		expect(parseAdminIds('')).toEqual([]);
	});

	it('returns [] for a blank / comma-only list', () => {
		expect(parseAdminIds(' , , ')).toEqual([]);
	});

	it('trims whitespace around each id', () => {
		expect(parseAdminIds(' a , b ,c ')).toEqual(['a', 'b', 'c']);
	});

	it('drops empty entries from stray commas', () => {
		expect(parseAdminIds('a,,b,')).toEqual(['a', 'b']);
	});

	it('dedupes while preserving first-seen order', () => {
		expect(parseAdminIds('a,b,a,c,b')).toEqual(['a', 'b', 'c']);
	});

	it('is case-sensitive (distinct-cased ids stay separate)', () => {
		expect(parseAdminIds('Abc,abc')).toEqual(['Abc', 'abc']);
	});
});

describe('getAdminUserIds (process.env)', () => {
	it('reads and parses process.env.ADMIN_USER_ID', () => {
		process.env.ADMIN_USER_ID = ' u1 , u2 , u1 ';
		expect(getAdminUserIds()).toEqual(['u1', 'u2']);
	});

	it('returns [] when unset', () => {
		delete process.env.ADMIN_USER_ID;
		expect(getAdminUserIds()).toEqual([]);
	});
});

describe('isAdminUserId', () => {
	it('is false for null / undefined / empty regardless of config', () => {
		process.env.ADMIN_USER_ID = 'u1,u2';
		expect(isAdminUserId(null)).toBe(false);
		expect(isAdminUserId(undefined)).toBe(false);
		expect(isAdminUserId('')).toBe(false);
	});

	it('matches a configured id exactly', () => {
		process.env.ADMIN_USER_ID = 'u1,u2';
		expect(isAdminUserId('u2')).toBe(true);
		expect(isAdminUserId('u3')).toBe(false);
	});
});

describe('getSystemAuthorId', () => {
	it('returns the first configured admin id', () => {
		process.env.ADMIN_USER_ID = 'first,second';
		expect(getSystemAuthorId()).toBe('first');
	});

	it('throws a clear error when unset', () => {
		delete process.env.ADMIN_USER_ID;
		expect(() => getSystemAuthorId()).toThrow(/ADMIN_USER_ID/);
	});
});

describe('logAdminConfig', () => {
	it('warns when ADMIN_USER_ID is empty', () => {
		delete process.env.ADMIN_USER_ID;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		logAdminConfig();
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('stays silent when at least one admin is configured', () => {
		process.env.ADMIN_USER_ID = 'u1';
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		logAdminConfig();
		expect(warn).not.toHaveBeenCalled();
	});
});
