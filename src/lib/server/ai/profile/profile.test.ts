/**
 * The composer and the two profiles as declarations: what `composeTurn` assembles from a
 * profile (block order = cache order, activations, tools, budget) and the drift guards that
 * pin the capabilities to the tool manifest. Retrieval is mocked to nothing; the chatbot's
 * lanes have their own test (`chatbot.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';
import { TOOL_MANIFEST } from '$lib/types/ai-tools';
import type { CapabilityId } from '$lib/types/assistant-profile';

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: vi.fn(),
	getSpreadsheetByFileId: vi.fn(),
	getMarkdownByFileId: vi.fn(),
}));
vi.mock('$lib/server/db/desk/mutations', () => ({
	updateSpreadsheetByFileId: vi.fn(),
	updateMarkdownByFileId: vi.fn(),
	renameFile: vi.fn(),
	createSpreadsheetFile: vi.fn(),
	createMarkdownFile: vi.fn(),
	deleteFile: vi.fn(),
}));
vi.mock('$lib/server/retrieval', () => ({
	generateEmbedding: vi.fn(async () => []),
	retrieve: vi.fn(async () => ({ chunks: [], totalFound: 0 })),
	formatContextForPrompt: vi.fn(() => ''),
	contextChunkCut: (result: { chunks: unknown[] }) => result.chunks.length,
}));
vi.mock('$lib/server/search', () => ({
	formatCatalogMap: vi.fn(() => '<catalog-map></catalog-map>'),
	buildSearchIndex: vi.fn(() => []),
	searchContent: vi.fn(async () => []),
}));
vi.mock('$lib/server/db/ai/mutations', () => ({ saveTurnTrace: vi.fn() }));
vi.mock('$lib/server/db/retrieval/queries', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/retrieval/queries')>()),
	countCorpus: vi.fn(async () => ({ documents: 0, chunks: 0 })),
	getCorpusMap: vi.fn(async () => null),
	countCorpusMaps: vi.fn(async () => 0),
}));

const { composeTurn, identityBlock, PROFILES } = await import('./index');
const { CHATBOT_PROFILE } = await import('./chatbot');
const { DESKBOT_PROFILE } = await import('./deskbot');
const { profileCapabilities, profileManifest } = await import('./manifest');
const { countCorpusMaps } = await import('$lib/server/db/retrieval/queries');
const { createTurnRecorder } = await import('../trace/recorder');
const { SHARED_RULES, DATA_BOUNDARY_RULE } = await import('./shared-rules');

type Turn = Parameters<typeof composeTurn>[1];

const turn = (overrides: Partial<Turn> = {}): Turn => ({
	userId: 'user-1',
	userMsgText: 'How does the retrieval pipeline decide which chunks enter the prompt?',
	locale: 'en',
	authCeiling: null,
	hasTools: true,
	toolsCooled: false,
	pageContext: null,
	scopes: [],
	...overrides,
});

const withoutInfra = (names: string[]) => names.filter((n) => n !== 'resolve_ref').sort();

describe('the profiles as declarations', () => {
	it('registers one profile per surface, completion first and compaction last', () => {
		expect(Object.keys(PROFILES).sort()).toEqual(['chatbot', 'deskbot']);
		for (const profile of Object.values(PROFILES)) {
			expect(profile.capabilities[0]?.id).toBe('completion');
			expect(profile.capabilities.at(-1)?.id).toBe('compaction');
			const ids = profile.capabilities.map((c) => c.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('gives both identities the shared rules, the data boundary last', () => {
		for (const profile of Object.values(PROFILES)) {
			const rules = profile.identity.rules;
			expect(rules.slice(-SHARED_RULES.length)).toEqual(SHARED_RULES);
			expect(rules.at(-1)).toBe(DATA_BOUNDARY_RULE);
			const block = identityBlock(profile.identity);
			expect(block.startsWith('<role>\n')).toBe(true);
			expect(block).toContain('</role>\n\n<instructions>\n- ');
			expect(block.endsWith('\n</instructions>')).toBe(true);
		}
	});

	// P2: the chatbot ran on a prompt that called it a workspace assistant with desk context.
	it('names Vely as the read-only v10r expert, never the workspace operator', () => {
		const vely = identityBlock(CHATBOT_PROFILE.identity);
		expect(vely).toContain('You are Vely');
		expect(vely).toContain('read-only');
		expect(vely).not.toContain('desk-context');
		expect(vely).not.toContain('workspace');
		expect(identityBlock(DESKBOT_PROFILE.identity)).toContain('workspace assistant');
	});

	it('wants tools on every chatbot turn and only on a desk turn with a scope', () => {
		expect(CHATBOT_PROFILE.wantsTools({ scopes: [] })).toBe(true);
		expect(DESKBOT_PROFILE.wantsTools({ scopes: [] })).toBe(false);
		expect(DESKBOT_PROFILE.wantsTools({ scopes: ['desk:read'] })).toBe(true);
	});

	it('budgets steps per profile: 3 for the chatbot, 3 read-only, 5 with a mutating scope', () => {
		expect(CHATBOT_PROFILE.stepBudget(turn())).toBe(3);
		expect(DESKBOT_PROFILE.stepBudget(turn({ scopes: [] }))).toBe(3);
		expect(DESKBOT_PROFILE.stepBudget(turn({ scopes: ['desk:read', 'desk:ask'] }))).toBe(3);
		expect(DESKBOT_PROFILE.stepBudget(turn({ scopes: ['desk:read', 'desk:write'] }))).toBe(5);
		expect(DESKBOT_PROFILE.stepBudget(turn({ scopes: ['desk:create'] }))).toBe(5);
		expect(DESKBOT_PROFILE.stepBudget(turn({ scopes: ['desk:delete'] }))).toBe(5);
	});
});

describe('capabilities ≡ TOOL_MANIFEST', () => {
	it('each profile, fully granted, mounts exactly the manifest tools of its surface, capability by capability', async () => {
		for (const profile of Object.values(PROFILES)) {
			const scopes = ['desk:read', 'desk:write', 'desk:create', 'desk:delete', 'desk:ask'] as const;
			const composed = await composeTurn(profile, turn({ scopes: [...scopes], userMsgText: 'hello there, docs' }));
			const manifest = TOOL_MANIFEST.filter((d) => d.surface === profile.surface);
			const expected = manifest.map((d) => d.name);
			expect(withoutInfra(Object.keys(composed.tools))).toEqual(expected.sort());
			for (const descriptor of manifest) {
				const capability = profile.capabilities.find((c) => c.id === descriptor.capability);
				expect(capability, `${descriptor.name} names capability ${descriptor.capability}`).toBeDefined();
			}
		}
	});

	it('every capability with tools owns exactly its manifest entries', async () => {
		const viewer = { userId: 'user-1', locale: 'en' as const, authCeiling: null };
		for (const profile of Object.values(PROFILES)) {
			const declared = await profileCapabilities(profile, viewer);
			for (const capability of declared.capabilities) {
				const owned = TOOL_MANIFEST.filter((d) => d.capability === capability.id)
					.map((d) => d.name)
					.sort();
				expect(withoutInfra(capability.tools.map((t) => t.name)), capability.id).toEqual(owned);
				for (const tool of capability.tools) {
					if (tool.name === 'resolve_ref') continue;
					expect(tool.description.length, tool.name).toBeGreaterThan(0);
					expect(tool.inputSchema, tool.name).toMatchObject({ type: 'object' });
				}
			}
			// The version hashes the same declaration twice to the same value.
			expect((await profileCapabilities(profile, viewer)).version).toBe(declared.version);
		}
	});

	it('inventories the project map as the system collection’s corpus map', async () => {
		vi.mocked(countCorpusMaps).mockClear();
		const viewer = { userId: 'user-1', locale: 'en' as const, authCeiling: null };
		const manifest = await profileManifest(CHATBOT_PROFILE, viewer);
		expect(manifest.grounding.map((g) => g.id)).toContain('project-map');
		expect(vi.mocked(countCorpusMaps)).toHaveBeenCalledWith(['system-docs'], 'project-docs');
	});

	it('mounts resolve_ref beside any tool and never alone', async () => {
		const withTools = await composeTurn(DESKBOT_PROFILE, turn({ scopes: ['desk:read'] }));
		expect(Object.keys(withTools.tools)).toContain('resolve_ref');
		const noScopes = await composeTurn(DESKBOT_PROFILE, turn({ scopes: [], hasTools: false }));
		expect(Object.keys(noScopes.tools)).toEqual([]);
		const cooled = await composeTurn(CHATBOT_PROFILE, turn({ hasTools: false, toolsCooled: true }));
		expect(Object.keys(cooled.tools)).toEqual([]);
	});
});

describe('composeTurn', () => {
	it('orders the prompt for the cache: identity, guidance, stable grounding, awareness, dynamic grounding, guides', async () => {
		const composed = await composeTurn(
			CHATBOT_PROFILE,
			turn({
				pageContext: { path: '/showcases/auth', title: 'Auth', breadcrumb: ['Identity'], surface: 'showcase' } as never,
				userMsgText: 'How does this page work?',
			}),
		);
		const sections = composed.blocks.map((b) => `${b.section}:${b.stable ? 'stable' : 'dynamic'}`);
		const order = ['identity:stable', 'guidance:stable', 'grounding:stable', 'awareness:dynamic', 'guide:dynamic'];
		const ranks = sections.map((s) => order.indexOf(s));
		expect(ranks.every((r) => r >= 0)).toBe(true);
		expect([...ranks]).toEqual([...ranks].sort((a, b) => a - b));
		expect(composed.blocks[0]).toMatchObject({ id: 'role', section: 'identity', stable: true });
		expect(composed.blocks[1]).toMatchObject({ id: 'completion-guidance', capability: 'completion' });
		expect(composed.blocks.map((b) => b.id)).toContain('current-page');
		// Deixis fired and nothing was retrieved: the abstention guide closes the prompt.
		expect(composed.blocks.at(-1)).toMatchObject({ id: 'page-abstention', capability: 'site-awareness' });
		expect(composed.systemPrompt).toBe(composed.blocks.map((b) => b.text).join('\n\n'));
		// Every block but the identity names its owner.
		for (const block of composed.blocks.slice(1)) expect(block.capability).toBeDefined();
	});

	it("records every capability's verdict, revised by a lane that knew better", async () => {
		const recorder = createTurnRecorder({
			conversationId: 'c',
			messageId: 'm',
			surface: 'chatbot',
			requestId: 'r',
			userId: 'user-1',
			t0: performance.now(),
		});
		const composed = await composeTurn(CHATBOT_PROFILE, turn(), recorder);
		const byId = new Map([...composed.state.activations.values()].map((a) => [a.id, a]));
		expect(byId.get('completion')).toEqual({ id: 'completion', active: true });
		expect(byId.get('navigation')).toEqual({ id: 'navigation', active: false, reason: 'no_intent' });
		expect(byId.get('site-awareness')).toEqual({ id: 'site-awareness', active: false, reason: 'no_page' });
		// The map lane found no corpus map.
		expect(byId.get('project-map')).toEqual({ id: 'project-map', active: false, reason: 'empty_corpus' });
		expect(recorder.trace().activations).toEqual([...composed.state.activations.values()]);
		expect(recorder.trace().blocks.map((b) => b.id)).toEqual(composed.blocks.map((b) => b.id));
		expect(recorder.trace().awareness).toEqual({ locale: 'en', authCeiling: null, page: null });
	});

	it("records a source as skipped when its capability did not activate, with the rule's reason", async () => {
		const composed = await composeTurn(DESKBOT_PROFILE, turn({ scopes: ['desk:read'] }));
		expect(composed.state.grounding.get('desk')).toEqual({
			id: 'desk',
			ran: false,
			skippedReason: 'scope_off',
			items: [],
		});
		const noNavigation = await composeTurn(CHATBOT_PROFILE, turn());
		expect(noNavigation.state.grounding.get('catalog')).toMatchObject({
			ran: false,
			skippedReason: 'gated_off',
		});
	});

	it('degrades honestly when every tool provider is cooled: no tools, the note, the reasons', async () => {
		const composed = await composeTurn(CHATBOT_PROFILE, turn({ hasTools: false, toolsCooled: true }));
		expect(Object.keys(composed.tools)).toEqual([]);
		expect(composed.blocks.map((b) => b.id)).not.toContain('completion-guidance');
		expect(composed.blocks.at(-1)).toMatchObject({ id: 'tool-degrade', capability: 'completion' });
		const reasons = Object.fromEntries([...composed.state.activations.values()].map((a) => [a.id, a.reason]));
		expect(reasons.completion).toBe('providers_cooled');
		expect(reasons['pattern-library']).toBe('providers_cooled');
		// The catalog map and the docs prefetch still ground the answer.
		expect(composed.blocks.map((b) => b.id)).toContain('catalog-map');
		expect(composed.state.activations.get('project-docs')?.active).toBe(true);
	});

	it('keeps the stable prefix identical across turns of one profile, whatever the question', async () => {
		const a = await composeTurn(CHATBOT_PROFILE, turn({ userMsgText: 'How is auth wired?' }));
		const b = await composeTurn(CHATBOT_PROFILE, turn({ userMsgText: 'Why Drizzle push-only?' }));
		const stable = (blocks: typeof a.blocks) => blocks.filter((x) => x.stable).map((x) => `${x.id}\n${x.text}`);
		expect(stable(a.blocks)).toEqual(stable(b.blocks));
	});

	it('runs the active verifiers over the answer and times each under its capability', async () => {
		const composed = await composeTurn(CHATBOT_PROFILE, turn());
		const verified = await composed.verify('No paths here.');
		expect(verified.citations).toEqual([]);
		expect(Object.keys(verified.stages).sort()).toEqual(['catalog']);
	});
});

describe('every CapabilityId is declared by exactly one profile capability', () => {
	it('covers the union', () => {
		const declared = new Set<CapabilityId>(Object.values(PROFILES).flatMap((p) => p.capabilities.map((c) => c.id)));
		const ids: CapabilityId[] = [
			'completion',
			'compaction',
			'project-map',
			'project-docs',
			'catalog',
			'navigation',
			'pattern-library',
			'site-awareness',
			'desk-awareness',
			'desk-files',
			'desk-edit',
			'desk-create',
			'desk-delete',
			'desk-ask',
			'desk-plan',
		];
		for (const id of ids) expect(declared.has(id), id).toBe(true);
		expect(declared.size).toBe(ids.length);
	});
});
