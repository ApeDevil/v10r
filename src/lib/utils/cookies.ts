/**
 * Client-side cookie helpers.
 * Wrapped to satisfy biome's noDocumentCookie rule.
 */

export function setCookie(
	name: string,
	value: string,
	options: { path?: string; maxAge?: number; sameSite?: string; secure?: boolean } = {},
) {
	const { path = '/', maxAge, sameSite = 'Lax', secure } = options;
	// biome-ignore lint/suspicious/noDocumentCookie: intentional client-side cookie management
	document.cookie = `${name}=${value};path=${path}${maxAge != null ? `;max-age=${maxAge}` : ''}${sameSite ? `;SameSite=${sameSite}` : ''}${secure ? ';Secure' : ''}`;
}

export function getCookie(name: string): string | undefined {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match?.[1];
}
