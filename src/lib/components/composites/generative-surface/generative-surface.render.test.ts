/**
 * The renderer as markup: server-renders `GenerativeSurface` over the committed fixtures and
 * reads the HTML. (The repo's unit lane runs in Node, so this is the component-level check;
 * interaction is covered on the session in `surface-session.svelte.test.ts`.)
 */
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import {
	ADVERSARIAL_SURFACES,
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from '#lib/generative-ui/fixtures/index.ts';
import GenerativeSurface from './GenerativeSurface.svelte';
import LazyGenerativeSurface from './LazyGenerativeSurface.svelte';

const scenario = (id: string) => {
	const found = GENERATIVE_SURFACE_SCENARIOS.find((s) => s.id === id);
	if (!found) throw new Error(`no scenario ${id}`);
	return found;
};

const html = (messages: readonly unknown[]) => render(GenerativeSurface, { props: { messages } }).body;

describe('GenerativeSurface (server render)', () => {
	it('renders a form with v10r components: labelled fields, bound values, a button', () => {
		const body = html(scenario('requirements-form').messages);
		expect(body).toContain('Project requirements');
		// FormField's <label for> points at the input it labels.
		const labelFor = body.match(/<label[^>]*for="([^"]+)"[^>]*>\s*Project name/)?.[1];
		expect(labelFor).toBeTruthy();
		expect(body).toMatch(new RegExp(`<input[^>]*id="${labelFor}"`));
		expect(body).toContain('<textarea');
		expect(body).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*Continue/);
		expect(body).toContain('Users must sign in');
		expect(body).toContain('aria-live="polite"');
		expect(body).toContain('Surface shown.');
	});

	it('renders the comparison as a real table with column headers', () => {
		const body = html(scenario('technology-comparison').messages);
		expect(body).toContain('<table');
		expect(body).toMatch(/<thead[\s\S]*<th[^>]*>(?:<!--[^>]*-->)*\s*Option/);
		expect(body).toContain('Row-level security keeps one schema while isolating tenants.');
		expect(body).toContain('Recommended: Postgres');
	});

	it('shows the follow-up once the messages list grows to include it', () => {
		const fixture = scenario('dynamic-update');
		const before = html(fixture.messages);
		const after = html([...fixture.messages, ...(fixture.followUp?.messages ?? [])]);
		expect(before).toContain('Estimating…');
		expect(before).not.toContain('<table');
		expect(after).toContain('About $70 per month.');
		expect(after).toContain('Within budget');
		expect(after).toContain('<table');
	});

	it('shows hostile-looking text as characters, never as markup', () => {
		const inert = ADVERSARIAL_SURFACES.find((f) => f.id === 'script-like-text');
		const body = html(inert?.messages ?? []);
		expect(body).not.toContain('<script>alert');
		expect(body).not.toContain('<img');
		expect(body).toContain('&lt;script>alert(document.cookie)&lt;/script>');
		expect(body).toContain('**bold** [link](https://example.com)');
		expect(body).not.toContain('<a ');
	});

	it('shows a refusal notice and no tree for a refused batch', () => {
		const refused = ADVERSARIAL_SURFACES.find((f) => f.id === 'unknown-component');
		const body = html(refused?.messages ?? []);
		expect(body).toContain('data-generative-refused');
		expect(body).not.toContain('IFrame');
		expect(body).not.toContain('example.com');
	});

	it('shows an accessible fallback for a child that has not arrived', () => {
		const body = html([
			{
				version: '1.0',
				createSurface: { surfaceId: 's', catalogId: 'https://v10r.dev/a2ui/catalogs/v10r/v1/catalog.json' },
			},
			{
				version: '1.0',
				updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Card', child: 'later' }] },
			},
		]);
		expect(body).toContain('class="sr-only">Loading…');
	});

	it('takes translated labels', () => {
		const body = render(GenerativeSurface, {
			props: { messages: scenario('technology-comparison').messages, labels: { shown: 'Oberfläche angezeigt.' } },
		}).body;
		expect(body).toContain('Oberfläche angezeigt.');
	});
});

describe('GenerativeSurface — the newer components, accessibly (server render)', () => {
	const example = (id: string) => {
		const found = GENERATIVE_SURFACE_CATALOG_EXAMPLES.find((s) => s.id === id);
		if (!found) throw new Error(`no example ${id}`);
		return found;
	};

	it('a chart is a data table with its bars: titled, one row per label, every value printed', () => {
		const body = html(example('cost-explorer').messages);
		expect(body).toMatch(/<table[^>]*data-generative-chart/);
		expect(body).toMatch(/<caption[^>]*>Monthly cost in dollars, 1,000 users<\/caption>/);
		expect(body).toMatch(/<th[^>]*>(?:<!--[^>]*-->)*Compute/);
		expect(body).toMatch(/var\(--chart-1\)[^"]*"[^>]*aria-hidden="true"/);
		expect(body).toMatch(/tabular-nums">40</);
		// Bars are scaled to the largest value: 40 is the full bar, 5 an eighth of it.
		expect(body).toContain('width: 100%');
		expect(body).toContain('width: 12.5%');
		expect(body).not.toMatch(/#[0-9a-f]{6}/i);
	});

	it('the follow-up chart shows both series, each named in its column header', () => {
		const fixture = example('cost-explorer');
		const body = html([...fixture.messages, ...(fixture.followUp?.messages ?? [])]);
		expect(body).toContain('5,000 users');
		expect(body).toMatch(/var\(--chart-2\)/);
		expect(body).toMatch(/tabular-nums">120</);
	});

	it('a step form: labelled progress, a collapsed section with a real trigger, and no feedback yet', () => {
		const body = html(example('step-form').messages);
		expect(body).toMatch(
			/role="progressbar"[^>]*aria-label="Step 1 of 2"|aria-label="Step 1 of 2"[^>]*role="progressbar"/,
		);
		expect(body).toMatch(/<button[^>]*>[\s\S]*Why a name\?/);
		expect(body).not.toContain('aria-invalid="true"');
		// The empty Notice is a slot for later feedback: no empty alert box is announced.
		expect(body).not.toContain('alert-warning');
	});

	it('validation feedback after the event: the field is invalid, described by its message', () => {
		const fixture = example('step-form');
		const body = html([...fixture.messages, ...(fixture.followUp?.messages ?? [])]);
		expect(body).toContain('aria-invalid="true"');
		const errorId = body.match(/<p id="([^"]+-error)"[^>]*role="alert"[^>]*>\s*Give the project a name first\./)?.[1];
		expect(errorId).toBeTruthy();
		expect(body).toMatch(new RegExp(`aria-describedby="${errorId}"`));
		expect(body).toContain('One field needs an answer before step 2.');
		expect(body).toContain('alert-warning');
	});

	it('the domain flow is an ordered, named list with each kind read out', () => {
		const body = html(example('request-flow').messages);
		expect(body).toMatch(/<ol[^>]*aria-label="A form post, from the browser to the database"/);
		expect(body).toContain('hooks.server.ts');
		expect(body).toContain('Client');
		expect(body).toContain('Data');
	});
});

describe('LazyGenerativeSurface (server render)', () => {
	it('renders only the loading status: the renderer arrives as a separate chunk', () => {
		const body = render(LazyGenerativeSurface, {
			props: { messages: scenario('technology-comparison').messages },
		}).body;
		expect(body).toContain('role="status"');
		expect(body).not.toContain('<table');
	});
});
