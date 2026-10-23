/**
 * The name-check half of the `encryption-reseal` job: move every stored vendor secret onto
 * the key ring's current key (`docs/blueprint/security/key-ring.md`).
 */
import { db } from '$lib/server/db';
import {
	listNameSourceSecretEnvelopes,
	replaceNameSourceSecretEnvelope,
} from '$lib/server/db/name-check/source-connections';
import { type EncryptionKeyRing, type ResealOutcome, resealEnvelopes } from '$lib/server/security';

/** Unaudited for the same reason as the AI half (`ai/provider-key-reseal.ts`). */
export async function resealNameSourceSecrets(ring: EncryptionKeyRing): Promise<ResealOutcome> {
	const rows = await listNameSourceSecretEnvelopes(db);
	return resealEnvelopes(
		rows.flatMap((r) => (r.secretCiphertext ? [{ key: r.vendor, envelope: r.secretCiphertext }] : [])),
		ring,
		(vendor, from, to) => replaceNameSourceSecretEnvelope(db, { vendor, from, to }),
	);
}
