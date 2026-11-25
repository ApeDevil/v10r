import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { TOOL_MANIFEST } from '#lib/types/ai-tools.ts';
import baseline from './baseline.json';
import { GoldenSetSchema } from './eval-case';
import golden from './golden-cases.json';

const set = v.parse(GoldenSetSchema, golden);

describe('the golden set', () => {
	it('matches the eval case schema and has unique ids', () => {
		const ids = set.cases.map((c) => c.id);
		expect(ids).toEqual([...new Set(ids)]);
	});

	it('names only tools that exist, and expects a tool to run only on the surface that has it', () => {
		const known = new Set(TOOL_MANIFEST.map((d) => d.name));
		for (const c of set.cases) {
			const onSurface = new Set(TOOL_MANIFEST.filter((d) => d.surface === c.surface).map((d) => d.name));
			for (const e of [...c.expect, ...(c.followUps ?? []).flatMap((f) => f.expect)]) {
				if (e.kind === 'calls-tool') expect(onSurface.has(e.tool), `${c.id}: ${e.tool}`).toBe(true);
				if (e.kind === 'calls-any-tool') for (const t of e.tools) expect(onSurface.has(t), `${c.id}: ${t}`).toBe(true);
				if (e.kind === 'never-calls') for (const t of e.tools) expect(known.has(t), `${c.id}: ${t}`).toBe(true);
			}
		}
	});

	it('scripts follow-ups only on the chatbot, and only expects updates and repeats where a turn can have them', () => {
		for (const c of set.cases) {
			if (c.followUps) expect(c.surface, c.id).toBe('chatbot');
			for (const e of c.expect) expect(['updates-surface', 'refuses-repeated-press'], c.id).not.toContain(e.kind);
			for (const f of c.followUps ?? [])
				if (f.expect.some((e) => e.kind === 'refuses-repeated-press')) expect(f.press?.resend, c.id).toBe(true);
		}
	});

	it('keeps the floor a rate', () => {
		expect(baseline.floor).toBeGreaterThanOrEqual(0);
		expect(baseline.floor).toBeLessThanOrEqual(1);
	});
});
