const CSRF_HEADER = { 'X-Requested-With': 'sveltekit' };

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
	return fetch(url, {
		...init,
		headers: { ...CSRF_HEADER, ...init?.headers },
	});
}

export { CSRF_HEADER };
