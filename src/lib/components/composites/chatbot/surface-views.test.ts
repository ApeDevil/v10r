import { describe, expect, it } from 'vitest';
import { surfaceViewsOf } from './surface-views';

const render = (toolCallId: string, surfaceId: string, messages: unknown[], ok = true) => ({
	type: 'tool-render_surface',
	toolCallId,
	state: 'output-available',
	input: {},
	output: ok ? { ok, surfaceId, messages } : { ok, surfaceId, refusals: [] },
});

describe('surfaceViewsOf', () => {
	it('shows a surface once, at its latest render, with every batch of that surface', () => {
		const views = surfaceViewsOf([
			{ parts: [render('c1', 'compare', ['create'])] },
			{ parts: [{ type: 'text' }, render('c2', 'other', ['create-other'])] },
			{ parts: [render('c3', 'compare', ['update'])] },
		]);
		expect(views.get('c1')).toBeNull();
		expect(views.get('c2')).toEqual({ surfaceId: 'other', renderId: 'c2', messages: ['create-other'] });
		expect(views.get('c3')).toEqual({ surfaceId: 'compare', renderId: 'c3', messages: ['create', 'update'] });
	});

	it('ignores refused and unfinished renders', () => {
		const pending = { ...render('c2', 'x', []), state: 'input-available' };
		const views = surfaceViewsOf([{ parts: [render('c1', 'x', [], false), pending] }]);
		expect(views.size).toBe(0);
	});
});
