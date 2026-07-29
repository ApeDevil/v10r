/**
 * Delete blog objects that were uploaded but never confirmed.
 *
 * The other half of binding upload issuance to a user. A presigned PUT succeeds
 * on its own — the object exists in R2 the moment the browser finishes, whether
 * or not the client ever calls confirm. Nothing referenced those objects:
 * `listAssets` reads the database, so an unconfirmed upload is invisible in the
 * UI, and `checkBlogObjectLimit` runs only at ISSUANCE, so the bucket cap it
 * enforces was being consumed by objects no one could see or remove.
 *
 * That made an authenticated author able to fill the bucket by requesting
 * presigns and simply never confirming — no error anywhere, and the only symptom
 * would be legitimate uploads starting to fail the object limit.
 *
 * The cutoff is what keeps this safe: only objects older than the confirmation
 * ticket's own lifetime are candidates, so an upload that is legitimately
 * in-flight can never be reaped out from under its own confirm.
 */
import { listAllAssetStorageKeys } from '$lib/server/blog/queries';
import { deleteBlogObject, listBlogObjectsOlderThan, UPLOAD_TICKET_TTL_MS } from '$lib/server/store/blog';

/**
 * Grace beyond the ticket TTL. A ticket that expires mid-upload is already
 * unconfirmable, so the object is genuinely dead — but leaving a margin means a
 * clock skew between this job and the issuing request can never turn a live
 * upload into a deletion.
 */
const GRACE_MS = 60 * 60 * 1000;

export async function blogOrphanReaper(): Promise<number> {
	const cutoff = new Date(Date.now() - UPLOAD_TICKET_TTL_MS - GRACE_MS);

	const [candidates, referenced] = await Promise.all([listBlogObjectsOlderThan(cutoff), listAllAssetStorageKeys()]);

	const keep = new Set(referenced);
	const orphans = candidates.filter((key) => !keep.has(key));

	let deleted = 0;
	for (const key of orphans) {
		try {
			await deleteBlogObject(key);
			deleted++;
		} catch (err) {
			// One unreachable object must not abort the sweep — the next run picks
			// it up, and a partial sweep is strictly better than none.
			console.error('[blog-orphan-reaper] failed to delete', key, err);
		}
	}

	return deleted;
}
