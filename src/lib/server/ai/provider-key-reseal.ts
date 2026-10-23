/**
 * The AI half of the `encryption-reseal` job: move every stored provider key onto the key
 * ring's current key (`docs/blueprint/security/key-ring.md`).
 */
import { db } from '$lib/server/db';
import { listProviderKeyEnvelopes, replaceProviderKeyEnvelope } from '$lib/server/db/ai/provider-connections';
import { type EncryptionKeyRing, type ResealOutcome, resealEnvelopes } from '$lib/server/security';

/**
 * Unaudited by design: the secret and its version stay the same, only the key that seals it
 * changes, and the job run itself is the record.
 */
export async function resealProviderKeys(ring: EncryptionKeyRing): Promise<ResealOutcome> {
	const rows = await listProviderKeyEnvelopes(db);
	return resealEnvelopes(
		rows.flatMap((r) => (r.apiKeyCiphertext ? [{ key: r.provider, envelope: r.apiKeyCiphertext }] : [])),
		ring,
		(provider, from, to) => replaceProviderKeyEnvelope(db, { provider, from, to }),
	);
}
