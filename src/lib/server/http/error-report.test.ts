import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportServerError } from './error-report';

const event = (routeId: string | null, pathname = '/x') =>
	({ route: { id: routeId }, url: new URL(`https://v10r.test${pathname}`) }) as unknown as RequestEvent;

describe('reportServerError', () => {
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	afterEach(() => log.mockClear());

	it('logs an unexpected error once, under the id it returns', () => {
		const result = reportServerError({ kind: 'unknown', error: new Error('db down'), event: event('/blog') });
		expect(result).toEqual({ errorId: expect.any(String) });
		expect(log).toHaveBeenCalledOnce();
		const line = JSON.parse(String(log.mock.calls[0]?.[0]));
		expect(line).toMatchObject({ status: 500, route: '/blog', message: 'db down' });
		expect(line.errorId).toBe((result as { errorId: string }).errorId);
	});

	// SvelteKit 3 started sending these here; they are intended responses, not faults.
	it('leaves an app error thrown with error() to its own body, unlogged', () => {
		expect(
			reportServerError({ kind: 'app', error: { status: 403, message: 'Forbidden' }, event: event('/admin') }),
		).toBeUndefined();
		expect(log).not.toHaveBeenCalled();
	});

	it('leaves validation errors to the default response, unlogged', () => {
		expect(
			reportServerError({
				kind: 'validation',
				error: { status: 400, message: 'Bad Request' },
				issues: [],
				event: event('/api/x'),
			}),
		).toBeUndefined();
		expect(log).not.toHaveBeenCalled();
	});

	it('answers an unmatched route with "Page not found" and no id', () => {
		expect(
			reportServerError({ kind: 'framework', error: { status: 404, message: 'Not Found' }, event: event(null) }),
		).toEqual({ message: 'Page not found' });
		expect(log).not.toHaveBeenCalled();
	});

	it('logs any other framework error, as before', () => {
		const result = reportServerError({
			kind: 'framework',
			error: { status: 405, message: 'Method Not Allowed' },
			event: event('/api/x'),
		});
		expect(result).toEqual({ errorId: expect.any(String) });
		expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ status: 405, message: 'Method Not Allowed' });
	});
});
