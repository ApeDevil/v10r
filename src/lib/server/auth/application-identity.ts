/**
 * Who an external application is, as far as Velociraptor can actually tell.
 *
 * An OAuth client's `name` is metadata the client wrote about itself — anyone can register
 * a client called "ChatGPT". What the authorization server CAN establish depends on how the
 * client identified itself:
 *
 *  - **Client ID Metadata Document** (`clientDiscoveryId` set, `client_id` is an HTTPS URL):
 *    the document was fetched from that URL, so the client controls that domain. The domain
 *    is verified; the name is still the domain owner's claim.
 *  - **Dynamic Client Registration**: nothing is verified. The name is self-declared and is
 *    shown as such; the redirect URI's host is the only hint, and it is shown as a hint.
 *
 * A small allowlist recognizes the CIMD domains of well-known MCP hosts so the page can say
 * "Claude (claude.ai)" — recognition keyed on the verified domain, never on the name.
 *
 * Pure: no database, no framework.
 */

/** CIMD client-id domains of MCP hosts this project has checked. Keyed by exact hostname. */
const RECOGNIZED_DOMAINS: Readonly<Record<string, string>> = {
	'claude.ai': 'Claude',
	'chatgpt.com': 'ChatGPT',
};

export type ApplicationIdentity =
	| {
			kind: 'verified-domain';
			/** Host of the client_id URL. */
			domain: string;
			/** Set when `domain` is on the recognized list. */
			recognizedAs: string | null;
			/** The document's own `client_name`: shown, but as the domain owner's claim. */
			declaredName: string | null;
	  }
	| {
			kind: 'self-declared';
			declaredName: string | null;
			/** The client's own `client_uri` host, if any — a hint, never proof. */
			declaredHost: string | null;
	  };

export interface ApplicationIdentityInput {
	clientId: string;
	name: string | null;
	uri: string | null;
	clientDiscoveryId: string | null;
}

/** Longest name shown, so a registration cannot push the page layout around. */
const MAX_DECLARED_NAME = 80;

function cleanName(name: string | null): string | null {
	if (!name) return null;
	// Control characters and bidi overrides would let a name impersonate surrounding text.
	const cleaned = name
		.replace(/[\p{Cc}\p{Cf}]/gu, '')
		.trim()
		.slice(0, MAX_DECLARED_NAME);
	return cleaned || null;
}

function httpsHost(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.hostname : null;
	} catch {
		return null;
	}
}

export function describeApplicationIdentity(input: ApplicationIdentityInput): ApplicationIdentity {
	const declaredName = cleanName(input.name);
	const domain = input.clientDiscoveryId ? httpsHost(input.clientId) : null;
	if (domain) {
		return { kind: 'verified-domain', domain, recognizedAs: RECOGNIZED_DOMAINS[domain] ?? null, declaredName };
	}
	return { kind: 'self-declared', declaredName, declaredHost: httpsHost(input.uri) };
}
