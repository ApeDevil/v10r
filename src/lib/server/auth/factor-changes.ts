/**
 * FACTOR CHANGES — one chokepoint for the side effects of every passkey /
 * TOTP mutation: audit trail, sibling-session revocation, notification email.
 *
 * Called from the Better Auth after-hook (auth/index.ts), which is the only
 * path a factor mutation can take — client-direct authClient calls included.
 *
 * The audit write is the one leg that must land; revocation and email each
 * degrade independently (logged, never thrown) so a mail outage cannot block
 * a security event from being recorded.
 *
 * Must never import the Better Auth instance (cycle: auth/index.ts → here).
 */
import { and, eq, ne } from 'drizzle-orm';
import { recordAuditEvent } from '$lib/server/admin/audit';
import { db } from '$lib/server/db';
import { session } from '$lib/server/db/schema';
import { stampRevocation } from './revocation';
import { factorChangeTemplate, sendAuthEmail } from './send-auth-email';

export type FactorChangeAction =
	| 'passkey.added'
	| 'passkey.removed'
	| 'passkey.renamed'
	| '2fa.enabled'
	| '2fa.disabled'
	| '2fa.backup_codes_regenerated';

const NOTIFY_LABELS: Partial<Record<FactorChangeAction, string>> = {
	'passkey.added': 'A new passkey was added to your account.',
	'passkey.removed': 'A passkey was removed from your account.',
	'2fa.enabled': 'Two-step verification (TOTP) was enabled on your account.',
	'2fa.disabled': 'Two-step verification (TOTP) was disabled on your account.',
};

interface FactorChangeParams {
	userId: string;
	userEmail: string;
	action: FactorChangeAction;
	detail?: Record<string, unknown>;
	ip?: string | null;
	/** Hard-delete the user's OTHER sessions (current one survives). */
	revokeSiblings?: boolean;
	/** Token of the session performing the change — kept alive on revocation. */
	currentSessionToken?: string | null;
}

export async function onFactorChanged(params: FactorChangeParams): Promise<void> {
	const { userId, userEmail, action, detail, ip, revokeSiblings, currentSessionToken } = params;

	await recordAuditEvent({
		actorId: userId,
		actorEmail: userEmail,
		action,
		targetType: 'auth.user',
		targetId: userId,
		detail,
		ipAddress: ip ?? undefined,
	});

	if (revokeSiblings) {
		try {
			await db
				.delete(session)
				.where(
					currentSessionToken
						? and(eq(session.userId, userId), ne(session.token, currentSessionToken))
						: eq(session.userId, userId),
				);
			// Deleting the rows is not enough on its own: `session.cookieCache`
			// answers getSession() from a signed cookie for up to 5 minutes, so a
			// revoked device stays authenticated across exactly the window this
			// call exists to close. The epoch is what makes it immediate; the
			// current token is spared so the acting device survives, as before.
			await stampRevocation(userId, currentSessionToken);
		} catch (err) {
			console.error('[factor-changes] sibling session revocation failed:', err);
		}
	}

	const label = NOTIFY_LABELS[action];
	if (label) {
		try {
			await sendAuthEmail({
				to: userEmail,
				subject: 'Security change on your Velociraptor account',
				html: factorChangeTemplate(label),
			});
		} catch (err) {
			console.error('[factor-changes] notification email failed:', err);
		}
	}
}
