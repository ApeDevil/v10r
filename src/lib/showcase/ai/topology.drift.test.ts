/**
 * Drift guards — pin the hand-mirrored halves of the showcase topology to their live
 * sources. Tests may import `$lib/server/*` freely (they are never bundled); the
 * modules under test must not. Mirrors the `tool-cards.drift.test.ts` technique for
 * text-scans: bracket a region, assert the anchors, match a narrow regex inside.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHATBOT_MAX_STEPS, DESK_MUTATE_MAX_STEPS, DESK_READ_MAX_STEPS } from '$lib/server/ai/config';
import { DESK_EXECUTABLE_TOOLS } from '$lib/server/ai/tools/desk-execute';
import { proposalStatusEnum } from '$lib/server/db/schema/ai/proposal';
import { TOOL_MANIFEST } from '$lib/types/ai-tools';
import { PIPELINE_REGISTRY } from '$lib/types/pipeline';
import type { PromptBlockId } from '$lib/types/turn-trace';
import {
	AI_LAYERS,
	buildToolCards,
	GUARD_STAGES,
	PROMPT_BLOCKS,
	PROPOSAL_STATES,
	PROPOSAL_TRANSITIONS,
	STEP_BUDGETS,
	STEP_LAYER,
	TOOL_LAYER,
	toolCounts,
} from './topology';

function read(relPath: string): string {
	return readFileSync(join(process.cwd(), relPath), 'utf8');
}

describe('tool cards ≡ TOOL_MANIFEST', () => {
	it('projects every manifest entry, nothing else, in order', () => {
		const cards = buildToolCards();
		expect(cards.map((c) => c.name)).toEqual(TOOL_MANIFEST.map((d) => d.name));
		for (const [i, card] of cards.entries()) {
			const d = TOOL_MANIFEST[i];
			expect(card.surface).toBe(d?.surface);
			expect(card.risk).toBe(d?.risk);
			expect(card.scope).toBe(d?.surface === 'deskbot' ? d.scope : null);
		}
	});

	it('zero surface overlap — the set glyph’s 0 is real', () => {
		const chatbot = new Set(TOOL_MANIFEST.filter((d) => d.surface === 'chatbot').map((d) => d.name));
		const deskbot = new Set(TOOL_MANIFEST.filter((d) => d.surface === 'deskbot').map((d) => d.name));
		for (const name of chatbot) expect(deskbot.has(name)).toBe(false);
		const counts = toolCounts();
		expect(counts.chatbot).toBe(chatbot.size);
		expect(counts.deskbot).toBe(deskbot.size);
		expect(counts.shared).toBe(0);
		expect(counts.union).toBe(chatbot.size + deskbot.size);
	});

	it('requiresApproval cards ≡ DESK_EXECUTABLE_TOOLS minus reversible creates', () => {
		// The one-door rule, witnessed a third time (after index.test.ts name coverage and
		// desk-execute.test.ts args round-trip): every write/destructive card requires
		// approval, and each such tool is replayable through executeDeskToolCall.
		const approvalCards = buildToolCards()
			.filter((c) => c.requiresApproval)
			.map((c) => c.name)
			.sort();
		const executableWriteDestructive = TOOL_MANIFEST.filter(
			(d) =>
				(d.risk === 'write' || d.risk === 'destructive') &&
				(DESK_EXECUTABLE_TOOLS as readonly string[]).includes(d.name),
		)
			.map((d) => d.name)
			.sort();
		expect(approvalCards).toEqual(executableWriteDestructive);
		// And inLoop is exactly the complement.
		for (const card of buildToolCards()) expect(card.inLoop).toBe(!card.requiresApproval);
	});
});

describe('mirrored literals', () => {
	it('step budgets equal ai/config.ts', () => {
		expect(STEP_BUDGETS.chatbot).toBe(CHATBOT_MAX_STEPS);
		expect(STEP_BUDGETS.deskRead).toBe(DESK_READ_MAX_STEPS);
		expect(STEP_BUDGETS.deskMutate).toBe(DESK_MUTATE_MAX_STEPS);
	});

	it('PROPOSAL_STATES equals the pg enum, order included', () => {
		expect([...PROPOSAL_STATES]).toEqual([...proposalStatusEnum.enumValues]);
	});

	it('every proposal state is reachable in the transition mirror', () => {
		const touched = new Set<string>(['pending']);
		for (const [from, to] of PROPOSAL_TRANSITIONS) {
			expect(PROPOSAL_STATES).toContain(from);
			expect(PROPOSAL_STATES).toContain(to);
			touched.add(from);
			touched.add(to);
		}
		for (const state of PROPOSAL_STATES) expect(touched).toContain(state);
	});
});

describe('guard chain mirror', () => {
	it('stage checks appear in guardAiRequest() in the mirrored order', () => {
		const source = read('src/lib/server/ai/guard.ts');
		const start = source.indexOf('function guardAiRequest');
		expect(start).toBeGreaterThan(-1);
		const body = source.slice(start);
		const positions = GUARD_STAGES.map((stage) => {
			const idx = body.indexOf(stage.check.split('(')[0] ?? stage.check);
			expect(idx, `guardAiRequest should contain ${stage.check}`).toBeGreaterThan(-1);
			return idx;
		});
		expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
	});
});

describe('prompt block mirror', () => {
	// Each published block id must still exist in its real assembler — a renamed or
	// removed block fails here before the diagram can advertise a phantom.
	const MARKERS: Record<PromptBlockId, { file: string; marker: string }> = {
		role: { file: 'src/lib/server/ai/config.ts', marker: 'DESK_SYSTEM_PROMPT' },
		completion: { file: 'src/lib/server/ai/config.ts', marker: '<completion>' },
		planning: { file: 'src/lib/server/ai/config.ts', marker: '<planning>' },
		permissions: { file: 'src/lib/server/ai/config.ts', marker: '<permissions>' },
		workspace: { file: 'src/lib/server/ai/context/system-prompt.ts', marker: 'The user is in workspace' },
		'desk-context': { file: 'src/lib/server/ai/context/system-prompt.ts', marker: '<desk-context>' },
		'desk-layout': { file: 'src/lib/server/ai/context/system-prompt.ts', marker: '<desk-layout>' },
		'project-overview': { file: 'src/lib/server/ai/context-assembly.ts', marker: '<project-overview>' },
		'current-page': { file: 'src/lib/server/ai/context/system-prompt.ts', marker: '<current-page' },
		'catalog-map': { file: 'src/lib/server/search/catalog-map.ts', marker: '<catalog-map>' },
	};

	const published = new Set([...PROMPT_BLOCKS.chatbot, ...PROMPT_BLOCKS.deskbot].map((b) => b.id));
	for (const id of published) {
		it(`block "${id}" still exists in its assembler`, () => {
			const spec = MARKERS[id];
			expect(read(spec.file)).toContain(spec.marker);
		});
	}
});

describe('registration maps', () => {
	it('STEP_LAYER covers exactly the pipeline registry', () => {
		// Compile-time exhaustive already (Record<PipelineStepId, …>); pin the runtime view too.
		for (const step of PIPELINE_REGISTRY) expect(STEP_LAYER[step.id]).toBeDefined();
	});

	it('TOOL_LAYER covers exactly the manifest names', () => {
		expect(Object.keys(TOOL_LAYER).sort()).toEqual(TOOL_MANIFEST.map((d) => d.name).sort());
	});

	it('layer order is a strict total order per surface', () => {
		for (const surface of ['chatbot', 'deskbot'] as const) {
			const orders = AI_LAYERS.filter((l) => l.surfaces.includes(surface)).map((l) => l.order);
			expect(new Set(orders).size).toBe(orders.length);
			expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
		}
	});

	it('every layer source path exists in the repo', () => {
		for (const layer of AI_LAYERS) {
			const paths = [layer.source, ...Object.values(layer.sourceBySurface ?? {})];
			for (const p of paths) {
				expect(() => statSync(join(process.cwd(), p)), `${layer.id}: ${p}`).not.toThrow();
			}
		}
	});
});
