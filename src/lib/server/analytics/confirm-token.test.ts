/**
 * Confirm-token contracts. The token is what makes a confirmation cost a
 * preceding page render — these tests pin the properties that claim rests on:
 * visitor binding, TTL, skew tolerance, and shape rejection before crypto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueConfirmToken, verifyConfirmToken } from './confirm-token';

const VISITOR_A = 'v1_00112233445566778899aabbccddeeff';
const VISITOR_B = 'v1_ffeeddccbbaa99887766554433221100';

describe('confirm token', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('round-trips for the visitor it was issued to', () => {
		const token = issueConfirmToken(VISITOR_A);
		expect(verifyConfirmToken(token, VISITOR_A)).toBe(true);
	});

	it('rejects the same token for a different visitor — a farmed token confirms nothing elsewhere', () => {
		const token = issueConfirmToken(VISITOR_A);
		expect(verifyConfirmToken(token, VISITOR_B)).toBe(false);
	});

	it('expires after the TTL', () => {
		const token = issueConfirmToken(VISITOR_A);
		vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
		expect(verifyConfirmToken(token, VISITOR_A)).toBe(false);
	});

	it('survives inside the TTL', () => {
		const token = issueConfirmToken(VISITOR_A);
		vi.advanceTimersByTime(9 * 60 * 1000);
		expect(verifyConfirmToken(token, VISITOR_A)).toBe(true);
	});

	it('tolerates small forward clock skew but rejects a far-future timestamp', () => {
		const token = issueConfirmToken(VISITOR_A);
		// verifier's clock is 1 min BEHIND the issuer's — inside the 2 min skew
		vi.setSystemTime(new Date('2026-08-11T11:59:00Z'));
		expect(verifyConfirmToken(token, VISITOR_A)).toBe(true);
		// 10 min behind — outside it: a forged future timestamp buys no long life
		vi.setSystemTime(new Date('2026-08-11T11:50:00Z'));
		expect(verifyConfirmToken(token, VISITOR_A)).toBe(false);
	});

	it('rejects malformed shapes before any crypto', () => {
		expect(verifyConfirmToken('', VISITOR_A)).toBe(false);
		expect(verifyConfirmToken('no-dot-here', VISITOR_A)).toBe(false);
		expect(verifyConfirmToken('.deadbeef', VISITOR_A)).toBe(false);
		expect(verifyConfirmToken('123.not-hex', VISITOR_A)).toBe(false);
		expect(verifyConfirmToken(`${Date.now()}.${'a'.repeat(63)}`, VISITOR_A)).toBe(false); // wrong MAC length
	});

	it('a tampered timestamp fails the MAC even when both parts are well-formed', () => {
		const token = issueConfirmToken(VISITOR_A);
		const [ts, mac] = token.split('.');
		expect(verifyConfirmToken(`${Number(ts) + 1}.${mac}`, VISITOR_A)).toBe(false);
	});
});
