/**
 * Pairing-code domain functions. Pure with respect to framework — only DB I/O.
 * Code format: 6 digits in alphabet [2-9] (no 0/1 to avoid O/I confusion).
 */
import crypto from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pairingCodes, sessions } from '$lib/server/db/schema/analytics';

export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const PAIRED_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

const ALPHABET = '23456789';

export function generateCode(): string {
	let out = '';
	for (let i = 0; i < 6; i++) out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
	return out;
}

export function formatCodeForDisplay(code: string): string {
	return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export interface CreatedPairing {
	code: string;
	expiresAt: Date;
}

export async function createPairingCode(adminUserId: string): Promise<CreatedPairing> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateCode();
		const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
		try {
			await db.insert(pairingCodes).values({ code, adminUserId, expiresAt });
			return { code, expiresAt };
		} catch (err) {
			// Collision on PK — retry. Anything else, bubble up.
			if ((err as { code?: string }).code !== '23505') throw err;
		}
	}
	throw new Error('Failed to allocate unique pairing code after retries');
}

export interface ClaimResult {
	ok: true;
	adminUserId: string;
	pairedAt: Date;
	expiresAt: Date;
}
export interface ClaimFailure {
	ok: false;
	reason: 'invalid' | 'expired' | 'consumed' | 'attempts_exceeded';
}

/**
 * Claim a code on behalf of a phone session. Atomic: increments attempt_count,
 * sets consumed_at + consumed_by_session_id when conditions hold.
 * Returns admin user id on success.
 */
export async function claimPairingCode(rawCode: string, sessionId: string): Promise<ClaimResult | ClaimFailure> {
	if (!/^[2-9]{6}$/.test(rawCode)) return { ok: false, reason: 'invalid' };

	const now = new Date();
	const result = await db
		.update(pairingCodes)
		.set({
			consumedAt: now,
			consumedBySessionId: sessionId,
			attemptCount: sql`${pairingCodes.attemptCount} + 1`,
		})
		.where(
			and(
				eq(pairingCodes.code, rawCode),
				isNull(pairingCodes.consumedAt),
				gt(pairingCodes.expiresAt, now),
				sql`${pairingCodes.attemptCount} < ${MAX_ATTEMPTS}`,
			),
		)
		.returning({ adminUserId: pairingCodes.adminUserId });

	const claimed = result[0];
	if (claimed) {
		const pairedAt = now;
		const pairedExpiresAt = new Date(now.getTime() + PAIRED_SESSION_TTL_MS);
		// Tag the session as paired (best-effort: insert path on session creation handles new sessions)
		await db
			.update(sessions)
			.set({ pairedAdminUserId: claimed.adminUserId, pairedAt })
			.where(eq(sessions.id, sessionId));
		return { ok: true, adminUserId: claimed.adminUserId, pairedAt, expiresAt: pairedExpiresAt };
	}

	// Failed: figure out why for better UX. Bump attempt count even on failed lookups
	// to harden against brute-force. We use a separate UPDATE since the prior one
	// only touched rows matching all conditions.
	await db
		.update(pairingCodes)
		.set({ attemptCount: sql`${pairingCodes.attemptCount} + 1` })
		.where(eq(pairingCodes.code, rawCode));

	const row = await db.select().from(pairingCodes).where(eq(pairingCodes.code, rawCode)).limit(1);
	const found = row[0];
	if (!found) return { ok: false, reason: 'invalid' };
	if (found.consumedAt) return { ok: false, reason: 'consumed' };
	if (found.expiresAt <= now) return { ok: false, reason: 'expired' };
	if (found.attemptCount >= MAX_ATTEMPTS) return { ok: false, reason: 'attempts_exceeded' };
	return { ok: false, reason: 'invalid' };
}

export async function revokePairing(code: string, adminUserId: string): Promise<boolean> {
	const result = await db
		.update(pairingCodes)
		.set({ consumedAt: new Date() })
		.where(and(eq(pairingCodes.code, code), eq(pairingCodes.adminUserId, adminUserId), isNull(pairingCodes.consumedAt)))
		.returning({ code: pairingCodes.code });
	if (result[0]) {
		// Untag any sessions paired by this code's admin (best-effort cleanup).
		await db
			.update(sessions)
			.set({ pairedAdminUserId: null, pairedAt: null })
			.where(eq(sessions.pairedAdminUserId, adminUserId));
	}
	return !!result[0];
}

export interface ActivePairing {
	code: string;
	createdAt: Date;
	expiresAt: Date;
	consumedAt: Date | null;
	pairedSessionId: string | null;
}

/** Active codes (unconsumed and unexpired) plus consumed pairings still within session TTL. */
export async function getActivePairings(adminUserId: string): Promise<ActivePairing[]> {
	const now = new Date();
	const cutoff = new Date(now.getTime() - PAIRED_SESSION_TTL_MS);
	const rows = await db
		.select({
			code: pairingCodes.code,
			createdAt: pairingCodes.createdAt,
			expiresAt: pairingCodes.expiresAt,
			consumedAt: pairingCodes.consumedAt,
			pairedSessionId: pairingCodes.consumedBySessionId,
		})
		.from(pairingCodes)
		.where(
			and(
				eq(pairingCodes.adminUserId, adminUserId),
				sql`(${pairingCodes.consumedAt} IS NULL AND ${pairingCodes.expiresAt} > ${now}) OR (${pairingCodes.consumedAt} > ${cutoff})`,
			),
		)
		.orderBy(desc(pairingCodes.createdAt))
		.limit(10);
	return rows;
}

/** True if the admin has any active paired sessions (consumed within 2h). */
export async function hasActivePairedSession(adminUserId: string): Promise<boolean> {
	const cutoff = new Date(Date.now() - PAIRED_SESSION_TTL_MS);
	const rows = await db
		.select({ id: sessions.id })
		.from(sessions)
		.where(
			and(eq(sessions.pairedAdminUserId, adminUserId), isNotNull(sessions.pairedAt), gt(sessions.pairedAt, cutoff)),
		)
		.limit(1);
	return rows.length > 0;
}
