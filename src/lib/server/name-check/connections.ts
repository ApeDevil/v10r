/**
 * Source connections — the saved rows turned into the credentials the sources use.
 *
 * A connection is what the administrator entered for one vendor: enabled or not, EUIPO's
 * client id and hosts, and a secret sealed under `ENCRYPTION_KEY`. This module opens the
 * seal and answers two questions with one read: what the admin page shows for each vendor
 * (`NameSourceConnection`, projected by `publicNameSourceConnection` before it crosses to a
 * client), and what `checkName()` may use (`credentials()`, a closure — the plaintext never
 * sits on a serializable field).
 *
 * "Configured" is decided here, once: enabled, the secret opened, and for EUIPO a client
 * id beside it. A source's `configured?` predicate then only asks whether its slot is null.
 */
import type { NameSourceConnectionRow } from '$lib/server/db/schema/name-check/source-connection';
import { type KeyStatus, openSecret } from '$lib/server/security';
import { NAME_SOURCE_VENDORS, type NameSourceVendor } from '$lib/types/db-enums';
import type { NameSourceCredentials } from './name-source';
import { EUIPO_DEFAULT_API_BASE, EUIPO_DEFAULT_TOKEN_URL } from './sources/euipo';

export const NAME_SOURCE_VENDOR_LABELS: Record<NameSourceVendor, string> = {
	euipo: 'EUIPO',
	tavily: 'Tavily',
	brave: 'Brave Search',
};

export interface NameSourceConnection {
	vendor: NameSourceVendor;
	name: string;
	enabled: boolean;
	keyStatus: KeyStatus;
	/** Usable by the check: enabled, the secret opened, and (EUIPO) a client id present. */
	configured: boolean;
	clientId: string | null;
	apiBase: string | null;
	tokenUrl: string | null;
	version: number;
	updatedAt: Date | null;
	updatedBy: string | null;
}

export interface NameSourceConnections {
	entries: NameSourceConnection[];
	/** At least one stored secret could not be opened — a configuration fault, not an empty setup. */
	degraded: boolean;
	/** What the sources receive — configured vendors only. A closure: the secrets are never a field of this object. */
	credentials: () => NameSourceCredentials;
	/** One vendor's opened secret whether or not the row is enabled — what a connection test of the saved secret needs. */
	secretOf: (vendor: NameSourceVendor) => string | null;
}

/** The sanitized projection for page data — no secret, no ciphertext, no closure. */
export interface PublicNameSourceConnection {
	vendor: NameSourceVendor;
	name: string;
	enabled: boolean;
	hasSecret: boolean;
	keyStatus: KeyStatus;
	configured: boolean;
	clientId: string | null;
	apiBase: string | null;
	tokenUrl: string | null;
	version: number;
	updatedAt: string | null;
	updatedBy: string | null;
}

/**
 * Build the connections from the saved rows. Vendors without a row appear as unconfigured
 * entries at `version: 0`, so the admin form and the check see one shape whether or not
 * anyone has saved anything yet.
 */
export async function resolveNameSourceConnections(
	rows: NameSourceConnectionRow[],
	encryptionKey: string | null,
): Promise<NameSourceConnections> {
	const byVendor = new Map(rows.map((row) => [row.vendor, row]));
	const opened = new Map<NameSourceVendor, string | null>();
	const usable = new Map<NameSourceVendor, string | null>();
	let degraded = false;

	const entries = await Promise.all(
		NAME_SOURCE_VENDORS.map(async (vendor): Promise<NameSourceConnection> => {
			const row = byVendor.get(vendor);
			const { plaintext, status } = await openSecret(row?.secretCiphertext, encryptionKey);
			if (status === 'undecryptable') degraded = true;

			const enabled = row?.enabled ?? false;
			const clientId = row?.clientId ?? null;
			const configured = enabled && plaintext !== null && (vendor !== 'euipo' || clientId !== null);
			opened.set(vendor, plaintext);
			usable.set(vendor, configured ? plaintext : null);

			return {
				vendor,
				name: NAME_SOURCE_VENDOR_LABELS[vendor],
				enabled,
				keyStatus: status,
				configured,
				clientId,
				apiBase: row?.apiBase ?? null,
				tokenUrl: row?.tokenUrl ?? null,
				version: row?.version ?? 0,
				updatedAt: row?.updatedAt ?? null,
				updatedBy: row?.updatedBy ?? null,
			};
		}),
	);

	const euipo = entries.find((entry) => entry.vendor === 'euipo');
	const euipoSecret = usable.get('euipo') ?? null;
	const credentials: NameSourceCredentials = {
		euipo:
			euipo?.clientId && euipoSecret
				? {
						clientId: euipo.clientId,
						clientSecret: euipoSecret,
						apiBase: euipo.apiBase ?? EUIPO_DEFAULT_API_BASE,
						tokenUrl: euipo.tokenUrl ?? EUIPO_DEFAULT_TOKEN_URL,
					}
				: null,
		tavilyApiKey: usable.get('tavily') ?? null,
		braveApiKey: usable.get('brave') ?? null,
	};

	return { entries, degraded, credentials: () => credentials, secretOf: (vendor) => opened.get(vendor) ?? null };
}

export function publicNameSourceConnection(entry: NameSourceConnection): PublicNameSourceConnection {
	return {
		vendor: entry.vendor,
		name: entry.name,
		enabled: entry.enabled,
		hasSecret: entry.keyStatus !== 'none',
		keyStatus: entry.keyStatus,
		configured: entry.configured,
		clientId: entry.clientId,
		apiBase: entry.apiBase,
		tokenUrl: entry.tokenUrl,
		version: entry.version,
		updatedAt: entry.updatedAt?.toISOString() ?? null,
		updatedBy: entry.updatedBy,
	};
}
