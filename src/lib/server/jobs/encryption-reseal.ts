/**
 * encryption-reseal — move every stored credential envelope onto the current
 * `ENCRYPTION_KEY`. After a rotation (new key in `ENCRYPTION_KEY`, old one in
 * `ENCRYPTION_KEY_PREVIOUS`) the first run re-seals the AI provider keys and name-check
 * vendor secrets; every later run finds nothing stale and costs one decrypt per row (a
 * handful). Returns the number of envelopes re-sealed.
 *
 * Fails, after re-sealing everything it can, when some envelope opens under no key of the
 * ring: that is a key dropped from `ENCRYPTION_KEY_PREVIOUS` too early, and a failed run on
 * `/admin/jobs` is where the operator looks before removing the previous key.
 */
import { resealProviderKeys } from '#lib/server/ai/index.ts';
import { resealNameSourceSecrets } from '#lib/server/name-check/index.ts';
import { getEncryptionKeyRing } from '#lib/server/security/index.ts';

export async function encryptionReseal(): Promise<number> {
	const ring = getEncryptionKeyRing();
	const outcomes = [await resealProviderKeys(ring), await resealNameSourceSecrets(ring)];
	const resealed = outcomes.reduce((n, o) => n + o.resealed, 0);
	const unreadable = outcomes.reduce((n, o) => n + o.unreadable, 0);
	if (unreadable > 0) {
		throw new Error(
			`${unreadable} stored secret(s) open under no key of the ring (re-sealed ${resealed}). ` +
				'Put the key they were sealed with back into ENCRYPTION_KEY_PREVIOUS, or re-enter those secrets.',
		);
	}
	return resealed;
}
