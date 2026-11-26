/**
 * Where the browser may go after the user answers the authorization page.
 *
 * Better Auth's consent endpoint answers with a URL: the client's callback (with a single-use
 * code, or `error=access_denied`) or, when it cannot trust the callback, its own error page.
 * SvelteKit 3 refuses to redirect to another origin unless the redirect names the origins it
 * permits, so the authorization page needs an explicit answer to "is this URL the callback
 * the authorization server already accepted?". This module is that answer:
 *
 * - The trusted callback is the `redirect_uri` inside the SIGNED authorization request — the
 *   consent endpoint verified that signature before answering — and it must also be one of the
 *   client's registered redirect URIs (loopback port may vary, RFC 8252 §7.3, as Better Auth
 *   accepts it). Nothing comes from an unsigned form field.
 * - The answer must point at exactly that callback (scheme, host, path); its query carries the
 *   code, `state` and `iss`, which the authorization server set.
 * - The permitted origin is per request and derived from that callback, so every registered
 *   client works (CIMD hosts, dynamically registered and loopback clients) and nothing is
 *   permitted globally.
 *
 * Framework-free: the authorization page adapter turns the outcome into `redirect()`.
 */

/** Schemes that execute or embed content instead of navigating to an application. */
const NON_NAVIGABLE_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:']);

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

function parse(uri: string, base?: string): URL | null {
	try {
		return new URL(uri, base);
	} catch {
		return null;
	}
}

function withoutLoopbackPort(url: URL): string | null {
	if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) return null;
	const copy = new URL(url.href);
	copy.port = '';
	return copy.href;
}

/**
 * Whether `requested` is one of the client's registered redirect URIs: an exact match, or a
 * loopback HTTP URI that differs only in its port (native apps bind an ephemeral port).
 */
export function matchesRegisteredRedirectUri(registered: readonly string[], requested: string): boolean {
	if (registered.includes(requested)) return true;
	const requestedUrl = parse(requested);
	if (!requestedUrl || requestedUrl.username || requestedUrl.password || requested.includes('#')) return false;
	const requestedWithoutPort = withoutLoopbackPort(requestedUrl);
	if (!requestedWithoutPort) return false;
	return registered.some((uri) => {
		const url = parse(uri);
		return url !== null && withoutLoopbackPort(url) === requestedWithoutPort;
	});
}

export type CallbackDestination =
	/** Back to this site (e.g. the authorization server's own error page): a normal redirect. */
	| { kind: 'local'; location: string }
	/** The client's verified callback: redirect, permitting only `callbackUri`'s origin. */
	| { kind: 'callback'; location: string; callbackUri: string }
	/** Neither: the answer does not point where the signed request said it would. */
	| { kind: 'refused' };

export interface CallbackContext {
	/** This site's origin (the authorization server's). */
	siteOrigin: string;
	/** `redirect_uri` from the signed authorization request; null when it had none. */
	signedRedirectUri: string | null;
	/** The client's registered redirect URIs. */
	registeredRedirectUris: readonly string[];
}

/** Classifies the consent endpoint's answer against the signed request and the registration. */
export function classifyCallbackDestination(location: string, context: CallbackContext): CallbackDestination {
	const target = parse(location, context.siteOrigin);
	if (!target) return { kind: 'refused' };
	if (target.origin === context.siteOrigin && target.protocol.startsWith('http')) {
		return { kind: 'local', location: `${target.pathname}${target.search}${target.hash}` };
	}
	if (NON_NAVIGABLE_SCHEMES.has(target.protocol) || target.username || target.password) return { kind: 'refused' };

	const signed = context.signedRedirectUri;
	if (!signed || !matchesRegisteredRedirectUri(context.registeredRedirectUris, signed)) return { kind: 'refused' };
	const callback = parse(signed);
	if (!callback || NON_NAVIGABLE_SCHEMES.has(callback.protocol)) return { kind: 'refused' };

	const same =
		target.protocol === callback.protocol && target.host === callback.host && target.pathname === callback.pathname;
	return same ? { kind: 'callback', location: target.href, callbackUri: callback.href } : { kind: 'refused' };
}

/**
 * The CSP `form-action` source for a callback. Browsers apply `form-action` to the redirect
 * that follows a native (no-JavaScript) form submission, so the authorization page's policy
 * must also name the callback it will answer to. Built from the parsed URL, so it can never
 * carry a space, quote or semicolon into the header.
 */
export function callbackFormActionSource(callbackUri: string): string | null {
	const url = parse(callbackUri);
	if (!url || NON_NAVIGABLE_SCHEMES.has(url.protocol)) return null;
	if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
	// A native app's private-use scheme (`com.example.app:/cb`, `cursor://…`): a scheme source.
	return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) ? url.protocol : null;
}

/** Adds `source` to a Content-Security-Policy header's `form-action` directive. */
export function permitFormActionSource(policy: string, source: string): string {
	const directives = policy.split(';').map((directive) => directive.trim());
	const index = directives.findIndex((directive) => directive.split(/\s+/)[0] === 'form-action');
	if (index === -1) return policy;
	if (directives[index].split(/\s+/).includes(source)) return policy;
	directives[index] = `${directives[index]} ${source}`;
	return directives.filter(Boolean).join('; ');
}
