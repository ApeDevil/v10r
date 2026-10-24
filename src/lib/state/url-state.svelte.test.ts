import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { urlParam } from './url-state';
import { createUrlState } from './url-state.svelte';

vi.mock('$app/env', () => ({ browser: true }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(() => Promise.resolve()) }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://v10r.dev/'), state: {} } }));

const spec = { q: urlParam.text(), range: urlParam.oneOf(['7', '30', '90'], '30') };
const mutablePage = page as unknown as { url: URL; state: Record<string, unknown> };

function at(href: string): void {
	mutablePage.url = new URL(href);
	mutablePage.state = { viewerOpen: true };
	vi.stubGlobal('window', { location: { href } });
}

beforeEach(() => {
	vi.mocked(goto).mockClear();
	at('https://v10r.dev/showcases/analytics?range=7&ref=nav');
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('createUrlState — navigate', () => {
	it('reads from page.url and writes with goto, replacing, keeping focus and scroll', async () => {
		const state = createUrlState(spec, { write: 'navigate' });
		expect(state.values).toEqual({ q: '', range: '7' });

		state.set({ range: '30' });
		expect(state.values.range).toBe('30');
		expect(goto).toHaveBeenCalledTimes(1);
		const [url, opts] = vi.mocked(goto).mock.calls[0] as [URL, object];
		expect(url.search).toBe('?ref=nav');
		expect(opts).toEqual({ replace: true, reset: false });
	});

	it('shows a debounced write at once and navigates once for a burst', () => {
		vi.useFakeTimers();
		const state = createUrlState(spec, { write: 'navigate', debounceMs: 250 });
		state.set({ q: 'a' });
		state.set({ q: 'ad' });
		state.set({ q: 'ada' });
		expect(state.values.q).toBe('ada');
		expect(goto).not.toHaveBeenCalled();

		vi.advanceTimersByTime(250);
		expect(goto).toHaveBeenCalledTimes(1);
		expect((vi.mocked(goto).mock.calls[0]?.[0] as URL).searchParams.get('q')).toBe('ada');
	});

	it('adds a history entry when asked to', () => {
		createUrlState(spec, { write: 'navigate', history: 'push' }).set({ range: '90' });
		expect(vi.mocked(goto).mock.calls[0]?.[1]).toMatchObject({ replace: false });
	});
});

describe('createUrlState — shallow', () => {
	it('keeps the values locally and mirrors them with a shallow goto that preserves page.state', () => {
		const state = createUrlState(spec, { write: 'shallow' });
		state.set({ q: 'chair' });

		expect(state.values).toEqual({ q: 'chair', range: '7' });
		const [url, opts] = vi.mocked(goto).mock.calls[0] as [URL, object];
		expect(url.search).toBe('?range=7&ref=nav&q=chair');
		expect(opts).toEqual({ shallow: true, replace: true, state: { viewerOpen: true } });
	});

	it('builds on the address bar, which carries earlier shallow writes that page.url never sees', () => {
		const state = createUrlState(spec, { write: 'shallow' });
		vi.stubGlobal('window', { location: { href: 'https://v10r.dev/showcases/analytics?range=7&ref=nav&q=a' } });
		state.set({ range: '90' });
		const url = vi.mocked(goto).mock.calls[0]?.[0] as URL;
		expect(url.searchParams.get('ref')).toBe('nav');
		expect(url.searchParams.get('range')).toBe('90');
	});

	it("after Back, seeds from the address bar, not the entry's loaded page.url", () => {
		// SvelteKit restores page.url to the URL the entry loaded with; the bar keeps the shallow write.
		mutablePage.url = new URL('https://v10r.dev/showcases/analytics?range=7');
		vi.stubGlobal('window', { location: { href: 'https://v10r.dev/showcases/analytics?range=7&q=arm' } });
		expect(createUrlState(spec, { write: 'shallow' }).values.q).toBe('arm');
	});

	it('links with every current value applied', () => {
		const state = createUrlState(spec, { write: 'shallow' });
		state.set({ q: 'arm' });
		expect(state.href({ range: '30' })).toBe('/showcases/analytics?ref=nav&q=arm');
	});
});
