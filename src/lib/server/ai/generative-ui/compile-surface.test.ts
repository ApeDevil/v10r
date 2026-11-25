import { MessageProcessor } from '@a2ui/web_core';
import { describe, expect, it } from 'vitest';
import {
	ADVERSARIAL_SURFACES,
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from '#lib/generative-ui/fixtures/index.ts';
import { GENERATIVE_UI_COMPONENTS } from '#lib/generative-ui/index.ts';
import { loadGenerativeUiCatalog } from '#lib/generative-ui/load-catalog.ts';
import { compileGenerativeSurface } from './compile-surface.ts';
import { createRenderSurfaceTool } from './render-surface-tool.ts';
import { buildGenerativeSurfacePrompt } from './surface-prompt.ts';

const surfaceIdOf = (messages: readonly unknown[]) =>
	(messages[0] as { createSurface: { surfaceId: string } }).createSurface.surfaceId;

/** What a renderer ends up holding after applying the messages: components and data. */
function renderedState(surfaceId: string, ...batches: unknown[][]) {
	const processor = new MessageProcessor([loadGenerativeUiCatalog()]);
	for (const batch of batches) expect(processor.processMessagesWithErrors(structuredClone(batch))).toEqual([]);
	const surface = processor.getSurface(surfaceId);
	if (!surface) throw new Error(`surface ${surfaceId} was not created`);
	const components = Object.fromEntries(
		[...surface.componentsModel.entries].map(([id, model]) => [id, { type: model.type, ...model.properties }]),
	);
	return { components, data: surface.dataModel.get('/') };
}

describe('compileGenerativeSurface — scenarios and catalog examples', () => {
	for (const scenario of [...GENERATIVE_SURFACE_SCENARIOS, ...GENERATIVE_SURFACE_CATALOG_EXAMPLES]) {
		const surfaceId = surfaceIdOf(scenario.messages);

		it(`${scenario.id}: the JSON messages compile unchanged`, () => {
			const compiled = compileGenerativeSurface({ format: 'json', source: scenario.messages }, { surfaceId });
			expect(compiled).toMatchObject({ ok: true, messages: scenario.messages });
		});

		it(`${scenario.id}: the Express source renders the same surface as the JSON`, () => {
			const compiled = compileGenerativeSurface({ format: 'express', source: scenario.express }, { surfaceId });
			if (!compiled.ok) throw new Error(JSON.stringify(compiled.refusals));
			expect(renderedState(surfaceId, compiled.messages)).toEqual(renderedState(surfaceId, scenario.messages));
		});

		if (scenario.followUp) {
			const followUp = scenario.followUp;
			it(`${scenario.id}: the follow-up compiles as an update of the rendered surface`, () => {
				const first = compileGenerativeSurface({ format: 'express', source: scenario.express }, { surfaceId });
				if (!first.ok) throw new Error(JSON.stringify(first.refusals));
				const viaJson = compileGenerativeSurface(
					{ format: 'json', source: followUp.messages },
					{ surfaceId, previous: first.graph },
				);
				const viaExpress = compileGenerativeSurface(
					{ format: 'express', source: followUp.express },
					{ surfaceId, previous: first.graph },
				);
				if (!viaJson.ok || !viaExpress.ok) throw new Error(JSON.stringify([viaJson, viaExpress]));
				expect(renderedState(surfaceId, first.messages, viaExpress.messages)).toEqual(
					renderedState(surfaceId, scenario.messages, followUp.messages),
				);
			});

			it(`${scenario.id}: the follow-up alone is refused — it updates a surface that does not exist yet`, () => {
				const alone = compileGenerativeSurface({ format: 'json', source: followUp.messages }, { surfaceId });
				expect(alone.ok).toBe(false);
				if (!alone.ok) expect(alone.refusals.every((r) => r.code === 'surface_not_created')).toBe(true);
			});
		}
	}
});

describe('compileGenerativeSurface — adversarial', () => {
	for (const fixture of ADVERSARIAL_SURFACES) {
		it(`${fixture.id}: ${fixture.expect}`, () => {
			const compiled = compileGenerativeSurface({ format: 'json', source: fixture.messages }, { surfaceId: 'probe' });
			if (fixture.expect === 'inert') {
				expect(compiled.ok).toBe(true);
				return;
			}
			expect(compiled.ok).toBe(false);
			if (!compiled.ok && fixture.refusal) {
				expect(compiled.refusals.map((r) => r.code)).toContain(fixture.refusal);
			}
		});
	}

	it('refuses an Express source naming a component outside the catalog', () => {
		const compiled = compileGenerativeSurface(
			{ format: 'express', source: 'root = Column([x])\nx = Image("https://example.com/a.png")' },
			{ surfaceId: 'probe' },
		);
		expect(compiled).toMatchObject({ ok: false, refusals: [{ code: 'invalid_express' }] });
	});

	it('refuses an Express source that addresses another surface', () => {
		const compiled = compileGenerativeSurface(
			{ format: 'express', source: 'surface("other")\nroot = Text("hi")' },
			{ surfaceId: 'probe' },
		);
		expect(compiled).toMatchObject({ ok: false, refusals: [{ code: 'foreign_surface' }] });
	});

	it('refuses an oversized source before parsing it', () => {
		const compiled = compileGenerativeSurface(
			{ format: 'express', source: `root = Text("${'x'.repeat(70_000)}")` },
			{ surfaceId: 'probe' },
		);
		expect(compiled).toMatchObject({ ok: false, refusals: [{ code: 'source_too_large' }] });
	});

	it('refuses JSON that does not parse', () => {
		expect(compileGenerativeSurface({ format: 'json', source: '[{' }, { surfaceId: 'probe' })).toMatchObject({
			ok: false,
			refusals: [{ code: 'invalid_json' }],
		});
	});

	it("never lets the renderer's state alias the caller's messages", () => {
		const scenario = GENERATIVE_SURFACE_SCENARIOS[0];
		const compiled = compileGenerativeSurface(
			{ format: 'json', source: scenario.messages },
			{ surfaceId: surfaceIdOf(scenario.messages) },
		);
		if (!compiled.ok) throw new Error('scenario should compile');
		expect(compiled.messages).not.toBe(scenario.messages);
		expect(compiled.messages[0]).not.toBe(scenario.messages[0]);
	});
});

describe('buildGenerativeSurfacePrompt', () => {
	it('describes every catalog component and nothing from the basic catalog', () => {
		for (const format of ['express', 'json'] as const) {
			const prompt = buildGenerativeSurfacePrompt(format);
			for (const name of GENERATIVE_UI_COMPONENTS) expect(prompt).toContain(name);
			// The Express grammar's own rules mention `Image` in a generic template example; the
			// component signatures and the JSON schemas must not.
			expect(prompt).not.toMatch(/^• (Image|Icon|Modal|Video)\(|"const": ?"(Image|Icon|Modal|Video)"/m);
		}
	});

	it('defaults to Express', () => {
		expect(buildGenerativeSurfacePrompt()).toBe(buildGenerativeSurfacePrompt('express'));
		expect(buildGenerativeSurfacePrompt('express')).toContain('Express');
	});
});

describe('render_surface tool', () => {
	const run = (tool: ReturnType<typeof createRenderSurfaceTool>, input: unknown) =>
		// biome-ignore lint/style/noNonNullAssertion: the tool defines execute
		tool.execute!(input as never, { toolCallId: 'c1', messages: [], context: {} }) as Promise<Record<string, unknown>>;

	it('returns validated messages, then accepts an update of the surface it showed', async () => {
		const scenario = GENERATIVE_SURFACE_SCENARIOS.find((s) => s.followUp);
		if (!scenario?.followUp) throw new Error('a scenario has a follow-up');
		const tool = createRenderSurfaceTool();
		const surfaceId = surfaceIdOf(scenario.messages);
		const shown = await run(tool, { surfaceId, express: scenario.express });
		expect(shown).toMatchObject({ ok: true, surfaceId });
		const updated = await run(tool, { surfaceId, express: scenario.followUp.express });
		expect(updated).toMatchObject({
			ok: true,
			messages: [{ updateComponents: { surfaceId } }, { updateDataModel: {} }],
		});
	});

	it('returns refusals as its result so the model can correct the source', async () => {
		const result = await run(createRenderSurfaceTool(), { surfaceId: 'probe', express: 'root = Script("x")' });
		expect(result).toMatchObject({ ok: false, refusals: [{ code: 'invalid_express' }] });
	});

	it('returns plain JSON data — the result crosses the stream serialized', () => {
		const scenario = GENERATIVE_SURFACE_SCENARIOS[1];
		const compiled = compileGenerativeSurface(
			{ format: 'express', source: scenario.express },
			{ surfaceId: surfaceIdOf(scenario.messages) },
		);
		if (!compiled.ok) throw new Error(JSON.stringify(compiled.refusals));
		expect(JSON.parse(JSON.stringify(compiled.messages))).toEqual(compiled.messages);
	});
});
