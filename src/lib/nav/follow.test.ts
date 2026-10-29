import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { match } from '$app/paths';
import { followHref } from './follow';

vi.mock('$app/navigation', () => ({ goto: vi.fn(() => Promise.resolve()) }));
vi.mock('$app/paths', () => ({ match: vi.fn() }));

const assign = vi.fn();

beforeEach(() => {
	vi.stubGlobal('window', {
		location: { href: 'https://v10r.test/showcases/desk', origin: 'https://v10r.test', assign },
	});
	vi.mocked(goto).mockClear();
	assign.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('followHref', () => {
	it('routes a link to a page through the client router', async () => {
		vi.mocked(match).mockResolvedValue({ id: '/[[locale=locale]]/blog', params: {} } as never);
		await followHref('/blog');
		expect(goto).toHaveBeenCalledWith('/blog');
		expect(assign).not.toHaveBeenCalled();
	});

	it('loads a same-origin URL no route serves as a document, which goto would reject', async () => {
		vi.mocked(match).mockResolvedValue(null);
		await followHref('/third-party-licenses.txt');
		expect(assign).toHaveBeenCalledWith(new URL('https://v10r.test/third-party-licenses.txt'));
		expect(goto).not.toHaveBeenCalled();
	});

	it('leaves an external URL to goto, which refuses it', async () => {
		await followHref('https://example.com/x');
		expect(goto).toHaveBeenCalledWith('https://example.com/x');
		expect(assign).not.toHaveBeenCalled();
	});
});
