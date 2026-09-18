/**
 * Name check — "what already exists that could conflict with this name?"
 *
 * A search aggregation over trade mark registries, company registers, RDAP and web
 * search, returning one report with per-source coverage and a descriptive conflict
 * signal. It never states legal availability; `docs/blueprint/name-check.md` is the
 * pattern, `/showcases/name-check` the page.
 *
 * Vendor credentials are the administrator's saved source connections
 * (`name_check.source_connection`, managed on `/admin/name-check`), never the environment.
 * `loadNameSourceConnections` is the one door from "what was saved" to "what this
 * operation will use": it reads the rows and supplies the deployment's encryption key,
 * once per operation, so a save reaches the next check on every instance with no cache to
 * invalidate. The public check uses the forgiving twin: a settings table it cannot read
 * turns two sources into `credentials_missing` rows, it does not fail the search.
 */
import { db } from '$lib/server/db';
import { listNameSourceConnections } from '$lib/server/db/name-check/source-connections';
import { EncryptionError, getEncryptionKey } from '$lib/server/security';
import { type NameSourceConnections, resolveNameSourceConnections } from './connections';
import { NameSourceError } from './errors';
import { type NameSourceCredentials, NO_CREDENTIALS } from './name-source';

export { type CheckNameOptions, checkName, type NameSourceOutcome } from './check';
export {
	NAME_SOURCE_VENDOR_LABELS,
	type NameSourceConnection,
	type NameSourceConnections,
	type PublicNameSourceConnection,
	publicNameSourceConnection,
} from './connections';
export { NameSourceError, type NameSourceErrorKind } from './errors';
export {
	type NameMatchDraft,
	type NameSource,
	type NameSourceContext,
	type NameSourceCredentials,
	NO_CREDENTIALS,
} from './name-source';
export { type NormalizedName, normalizeName } from './normalize';
export { type NameCheckQuery, toNameCheckQuery } from './query';
export { conflictSignal } from './signal';
export { bestSimilarity, colognePhonetic, scoreSimilarity } from './similarity';
export { NAME_SOURCES } from './sources';
export { EUIPO_DEFAULT_API_BASE, EUIPO_DEFAULT_TOKEN_URL } from './sources/euipo';

async function readRows() {
	try {
		return await listNameSourceConnections(db);
	} catch (err) {
		const unreadable = new NameSourceError('unavailable', 'source connections could not be read');
		unreadable.cause = err;
		throw unreadable;
	}
}

/** The validated key, or null when the deployment has none — entries then report `undecryptable`. */
function readEncryptionKeyOrNull(): string | null {
	try {
		return getEncryptionKey();
	} catch (err) {
		if (err instanceof EncryptionError) return null;
		throw err;
	}
}

/** The saved source connections as one operation's snapshot. Throws when the table cannot be read. */
export async function loadNameSourceConnections(): Promise<NameSourceConnections> {
	return resolveNameSourceConnections(await readRows(), readEncryptionKeyOrNull());
}

/**
 * The credentials one public check runs with. Never throws: the check's contract is that
 * no single dependency fails it, and the settings table is a dependency like any source.
 * The line logged names the error class, never a query.
 */
export async function loadNameSourceCredentials(): Promise<NameSourceCredentials> {
	try {
		return (await loadNameSourceConnections()).credentials();
	} catch (err) {
		const cause = err instanceof NameSourceError && err.cause instanceof Error ? err.cause : err;
		console.error(`[name-check] source connections unreadable (${cause instanceof Error ? cause.name : typeof cause})`);
		return NO_CREDENTIALS;
	}
}
