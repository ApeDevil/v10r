/**
 * The re-seal loop every table of envelopes shares: open each with the ring, seal the stale
 * ones under the current key, and swap them in only while the row still holds what was read.
 * The owning domain supplies the rows and the compare-and-swap write; this module never sees
 * a table.
 */
import { type EncryptionKeyRing, resealEnvelope } from './aes-gcm';

export interface StoredEnvelope<K> {
	key: K;
	envelope: string;
}

export interface ResealOutcome {
	/** Envelopes moved onto the current key. */
	resealed: number;
	/** Envelopes no key of the ring opens — a key left the ring before this sweep finished. */
	unreadable: number;
}

export async function resealEnvelopes<K>(
	rows: readonly StoredEnvelope<K>[],
	ring: EncryptionKeyRing,
	replace: (key: K, from: string, to: string) => Promise<boolean>,
): Promise<ResealOutcome> {
	const outcome: ResealOutcome = { resealed: 0, unreadable: 0 };
	for (const row of rows) {
		let next: string | null;
		try {
			next = await resealEnvelope(row.envelope, ring);
		} catch {
			outcome.unreadable += 1;
			continue;
		}
		// A false swap means an administrator saved a new secret meanwhile — sealed under the
		// current key already, so there is nothing left to move.
		if (next !== null && (await replace(row.key, row.envelope, next))) outcome.resealed += 1;
	}
	return outcome;
}
