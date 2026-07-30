/**
 * Factor-change side-effect contracts:
 * 1. Every change writes an audit row (action, targetType, targetId).
 * 2. revokeSiblings deletes sessions; without it, none are touched.
 * 3. Email/revocation failures degrade — the audit write still lands and
 *    onFactorChanged never throws.
 * 4. Notification emails fire only for the notify-worthy actions
 *    (rename and backup-code rotation are audit-only).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordAuditEvent = vi.fn(async (_input: unknown) => {});
const sendAuthEmail = vi.fn(async (_params: unknown) => {});
const deleteWhere = vi.fn(async (_condition: unknown) => []);
const redisSet = vi.fn(async (..._args: unknown[]) => 'OK');

vi.mock('$lib/server/admin/audit', () => ({ recordAuditEvent: (input: unknown) => recordAuditEvent(input) }));
vi.mock('$lib/server/db', () => ({
	db: { delete: vi.fn(() => ({ where: deleteWhere })) },
}));
vi.mock('./send-auth-email', () => ({
	sendAuthEmail: (params: unknown) => sendAuthEmail(params),
	factorChangeTemplate: (label: string) => `<html>${label}</html>`,
}));
// Without this, the revokeSiblings path falls through stampRevocation() to the
// REAL Upstash client — an unbounded network call that hangs the test whenever
// Upstash is reachable but stalling (same stub shape as revocation.test.ts).
vi.mock('$lib/server/cache', () => ({
	redis: {
		get: vi.fn(async () => null),
		set: (...args: unknown[]) => redisSet(...args),
		del: vi.fn(async () => 1),
	},
}));

const { onFactorChanged } = await import('./factor-changes');

const BASE = {
	userId: 'usr_1',
	userEmail: 'user@example.com',
	ip: '203.0.113.5',
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('onFactorChanged', () => {
	it('writes the audit row with the auth.user target', async () => {
		await onFactorChanged({ ...BASE, action: 'passkey.added' });

		expect(recordAuditEvent).toHaveBeenCalledOnce();
		expect(recordAuditEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: 'usr_1',
				actorEmail: 'user@example.com',
				action: 'passkey.added',
				targetType: 'auth.user',
				targetId: 'usr_1',
				ipAddress: '203.0.113.5',
			}),
		);
	});

	it('revokes sibling sessions only when asked', async () => {
		await onFactorChanged({ ...BASE, action: 'passkey.added' });
		expect(deleteWhere).not.toHaveBeenCalled();
		expect(redisSet).not.toHaveBeenCalled();

		await onFactorChanged({
			...BASE,
			action: 'passkey.removed',
			revokeSiblings: true,
			currentSessionToken: 'tok_current',
		});
		expect(deleteWhere).toHaveBeenCalledOnce();
		expect(redisSet).toHaveBeenCalledOnce();
	});

	it('sends a notification email for notify-worthy actions only', async () => {
		await onFactorChanged({ ...BASE, action: '2fa.enabled' });
		expect(sendAuthEmail).toHaveBeenCalledOnce();

		sendAuthEmail.mockClear();
		await onFactorChanged({ ...BASE, action: 'passkey.renamed' });
		await onFactorChanged({ ...BASE, action: '2fa.backup_codes_regenerated' });
		expect(sendAuthEmail).not.toHaveBeenCalled();
	});

	it('still records the audit event when the email send fails', async () => {
		sendAuthEmail.mockRejectedValueOnce(new Error('mail outage'));

		await expect(onFactorChanged({ ...BASE, action: '2fa.disabled', revokeSiblings: true })).resolves.toBeUndefined();
		expect(recordAuditEvent).toHaveBeenCalledOnce();
		expect(deleteWhere).toHaveBeenCalledOnce();
	});

	it('still completes when session revocation fails', async () => {
		deleteWhere.mockRejectedValueOnce(new Error('db outage'));

		await expect(
			onFactorChanged({ ...BASE, action: 'passkey.removed', revokeSiblings: true }),
		).resolves.toBeUndefined();
		expect(recordAuditEvent).toHaveBeenCalledOnce();
	});
});
