/**
 * Recorded context-probe reports — the signed-out default for the `#probe`
 * section. Each example pairs a query with the `ProbeReport` the live endpoint
 * produced for it against the demo workspace, so the section teaches the three
 * interesting shapes (gate closed / grounded / deixis-seeded, and for the desk:
 * grounded-read / plan-governor-fired) without an account or an embedding.
 *
 * Synthetic data rules (leak-gate enforced): demo titles only, no UUIDs, no
 * prompt bodies — a `ProbeReport` structurally cannot carry one.
 */
import type { AiSurfaceId } from '$lib/types/ai-tools';
import type { ProbeReport } from '$lib/types/context-probe';

export interface ProbeExample {
	id: string;
	/** The query that produced the recorded report — also prefills the input. */
	query: string;
	report: ProbeReport;
}

const CHATBOT_TOOLS = [
	'get_llmwiki_pages',
	'get_rawrag_chunks',
	'search_catalog',
	'search_project_docs',
	'search_pattern_library',
];

const DESKBOT_TOOLS = [
	'desk_list_files',
	'desk_read_file',
	'desk_file_tree',
	'desk_search_files',
	'desk_get_open_panels',
	'desk_update_cells',
	'desk_rename_file',
	'desk_update_markdown',
	'desk_create_spreadsheet',
	'desk_create_markdown',
	'desk_delete_file',
	'desk_search_knowledge',
	'desk_propose_plan',
];

/** Demo-workspace inventory, shared by every chatbot example. */
const CHATBOT_INVENTORY: ProbeReport['inventory'] = [
	{ lane: 'llmwiki', documents: 4 },
	{ lane: 'docs', documents: 148, chunks: 3184 },
];

const chatbotTrivial: ProbeReport = {
	surface: 'chatbot',
	gates: [
		{ id: 'ground_docs', fired: false },
		{ id: 'page_deixis', fired: false },
	],
	inventory: CHATBOT_INVENTORY,
	tools: CHATBOT_TOOLS,
	lanes: [
		{ lane: 'llmwiki', ran: false, skippedReason: 'gated_off', cutoff: 6, candidates: [] },
		{ lane: 'docs', ran: false, skippedReason: 'gated_off', cutoff: 4, candidates: [] },
	],
	prompt: {
		blocks: [
			{ id: 'role', tokensEst: 96, dynamic: false },
			{ id: 'catalog-map', tokensEst: 402, dynamic: false },
		],
		totalTokensEst: 498,
	},
	docsQuery: 'hi',
};

const chatbotGroundedProbe: ProbeReport = {
	surface: 'chatbot',
	gates: [
		{ id: 'ground_docs', fired: true },
		{ id: 'page_deixis', fired: false },
	],
	inventory: CHATBOT_INVENTORY,
	tools: CHATBOT_TOOLS,
	lanes: [
		{
			lane: 'llmwiki',
			ran: true,
			cutoff: 6,
			candidates: [
				{
					title: 'AI request guarding',
					preview: 'Every AI endpoint runs the same four-gate preamble before any work happens.',
					source: 'llmwiki',
					tier: 'llmwiki',
					chosen: true,
				},
			],
		},
		{
			lane: 'docs',
			ran: true,
			cutoff: 4,
			candidates: [
				{
					title: 'AI Abuse Controls & Budget',
					preview:
						'guardAiRequest single-sources the auth → aiConfigured → rate-limit → daily-budget preamble so per-surface routes stay thin…',
					score: 0.781,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'AI Surfaces',
					preview:
						'Two surfaces share one orchestrator: the chatbot (read-only, grounded) and the deskbot (agentic, plan-gated)…',
					score: 0.712,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Rate limiting',
					preview: 'Limiters are per-user sliding windows in Redis; every consumer names its own prefix…',
					score: 0.664,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Provider routing',
					preview: 'Cooldowns rotate a cooled provider out of the attempt chain before the stream starts…',
					score: 0.598,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Multi-client core',
					preview: 'Domain modules stay framework-free; adapters wrap them per client type…',
					score: 0.541,
					source: 'vector',
					tier: '1',
					chosen: false,
				},
				{
					title: 'Notifications delivery',
					preview: 'Delivery jobs drain per-channel queues with capped retries…',
					score: 0.402,
					source: 'vector',
					tier: '1',
					chosen: false,
				},
			],
		},
	],
	prompt: {
		blocks: [
			{ id: 'role', tokensEst: 96, dynamic: false },
			{ id: 'llmwiki-context', tokensEst: 311, dynamic: true },
			{ id: 'project-overview', tokensEst: 214, dynamic: false },
			{ id: 'retrieval-context', tokensEst: 468, dynamic: true },
			{ id: 'catalog-map', tokensEst: 402, dynamic: false },
		],
		totalTokensEst: 1491,
	},
	docsQuery: 'How does the AI guard chain protect these endpoints?',
};

const chatbotDeixis: ProbeReport = {
	surface: 'chatbot',
	gates: [
		{ id: 'ground_docs', fired: true },
		{ id: 'page_deixis', fired: true },
	],
	inventory: CHATBOT_INVENTORY,
	tools: CHATBOT_TOOLS,
	lanes: [
		{ lane: 'llmwiki', ran: true, cutoff: 6, candidates: [] },
		{
			lane: 'docs',
			ran: true,
			cutoff: 4,
			candidates: [
				{
					title: 'AI Surfaces',
					preview: 'The chatbot page visualizes the surface’s functional layers: guard, prompt, nRAG, tools…',
					score: 0.743,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Site awareness',
					preview:
						'A passive <current-page> block binds “this” and “here” to the resolved route; deixis seeds the retrieval query…',
					score: 0.706,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Layered RAG',
					preview: 'One retrieval kernel, two profiles: tiers, fusion, and per-surface corpora…',
					score: 0.631,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Knowledge base',
					preview: 'llmwiki pages compile rawrag chunks into TLDR + pointers…',
					score: 0.588,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Pattern library',
					preview: 'The registry publishes patterns with invariants an agent preserves when emulating…',
					score: 0.512,
					source: 'vector',
					tier: '1',
					chosen: false,
				},
			],
		},
	],
	prompt: {
		blocks: [
			{ id: 'role', tokensEst: 96, dynamic: false },
			{ id: 'project-overview', tokensEst: 214, dynamic: false },
			{ id: 'retrieval-context', tokensEst: 452, dynamic: true },
			{ id: 'current-page', tokensEst: 38, dynamic: true },
			{ id: 'catalog-map', tokensEst: 402, dynamic: false },
		],
		totalTokensEst: 1202,
	},
	docsQuery: 'AI Chatbot. Showcases AI. How does this page work?',
};

const deskbotGroundedRead: ProbeReport = {
	surface: 'deskbot',
	gates: [{ id: 'require_plan', fired: false, inputs: { mutatingScopeGranted: true, destructiveIntent: false } }],
	inventory: [{ lane: 'desk', documents: 3, chunks: 41 }],
	tools: DESKBOT_TOOLS,
	lanes: [
		{
			lane: 'desk',
			ran: true,
			cutoff: 5,
			candidates: [
				{
					title: 'Launch Plan',
					preview: 'Budget ceiling for the demo launch is 12,400 — hard cap agreed with demo@example.com…',
					score: 0.802,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Budget Sheet',
					preview: 'B4: 12400\nB5: media\nB6: 3100…',
					score: 0.734,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Meeting Notes',
					preview: 'Decision: revisit the launch budget after the beta report lands…',
					score: 0.651,
					source: 'bm25',
					tier: '2',
					chosen: true,
				},
				{
					title: 'Reading List',
					preview: 'Articles on pricing pages and launch retros…',
					score: 0.377,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Ideas Scratchpad',
					preview: 'Random one-liners; mostly unrelated…',
					score: 0.298,
					source: 'bm25',
					tier: '2',
					chosen: true,
				},
				{
					title: 'Old Draft',
					preview: 'Superseded copy for the landing page…',
					score: 0.211,
					source: 'vector',
					tier: '1',
					chosen: false,
				},
			],
		},
	],
	prompt: {
		blocks: [
			{ id: 'role', tokensEst: 174, dynamic: false },
			{ id: 'completion', tokensEst: 58, dynamic: false },
			{ id: 'permissions', tokensEst: 41, dynamic: true },
		],
		totalTokensEst: 273,
	},
};

const deskbotPlanGoverned: ProbeReport = {
	surface: 'deskbot',
	gates: [{ id: 'require_plan', fired: true, inputs: { mutatingScopeGranted: true, destructiveIntent: true } }],
	inventory: [{ lane: 'desk', documents: 3, chunks: 41 }],
	tools: DESKBOT_TOOLS,
	lanes: [
		{
			lane: 'desk',
			ran: true,
			cutoff: 5,
			candidates: [
				{
					title: 'Budget Sheet',
					preview: 'A1: task\nB1: status\nA2: venue\nB2: done…',
					score: 0.699,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
				{
					title: 'Launch Plan',
					preview: 'Checklist with completed and open items…',
					score: 0.612,
					source: 'vector',
					tier: '1',
					chosen: true,
				},
			],
		},
	],
	prompt: {
		blocks: [
			{ id: 'role', tokensEst: 174, dynamic: false },
			{ id: 'completion', tokensEst: 58, dynamic: false },
			{ id: 'planning', tokensEst: 66, dynamic: true },
			{ id: 'permissions', tokensEst: 41, dynamic: true },
		],
		totalTokensEst: 339,
	},
};

/** The recorded example set per surface, in display order. */
export const PROBE_EXAMPLES: Record<AiSurfaceId, ProbeExample[]> = {
	chatbot: [
		{ id: 'trivial', query: 'hi', report: chatbotTrivial },
		{
			id: 'grounded',
			query: 'How does the AI guard chain protect these endpoints?',
			report: chatbotGroundedProbe,
		},
		{ id: 'deixis', query: 'How does this page work?', report: chatbotDeixis },
	],
	deskbot: [
		{
			id: 'grounded',
			query: 'What do my project notes say about the launch budget?',
			report: deskbotGroundedRead,
		},
		{
			id: 'plan',
			query: 'Delete every completed row from all sheets',
			report: deskbotPlanGoverned,
		},
	],
};
