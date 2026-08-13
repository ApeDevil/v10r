/**
 * Recorded chatbot turn — a grounded question answered through the llmwiki-first
 * retrieval profile: overview anchor → wiki search → relevance-gated system-docs
 * prefetch → context assembly → generation with one mid-stream drill → post-stream
 * citation verification. Timings are from a real dev-run of this profile, rounded.
 */

import type { SurfaceReplay } from '../replay';
import { ev } from './build';

const overviewActive = ev('llmwiki:overview', 'active', { start: 0 });
const overviewDone = ev('llmwiki:overview', 'done', { start: 0, dur: 120 });
const searchActive = ev('llmwiki:search', 'active', { start: 130 });
const searchDone = ev('llmwiki:search', 'done', { start: 130, dur: 210 });
const docsActive = ev('system-docs', 'active', { start: 350 });
const docsDone = ev('system-docs', 'done', { start: 350, dur: 190 });
const contextActive = ev('llmwiki:context', 'active', { start: 560 });
const contextDone = ev('llmwiki:context', 'done', { start: 560, dur: 40 });
const generateActive = ev('generate', 'active', { start: 640 });
const drillActive = ev('rawrag:drill', 'active', { start: 1400, instanceKey: 'drill#0' });
const drillDone = ev('rawrag:drill', 'done', { start: 1400, dur: 230, instanceKey: 'drill#0' });
const generateDone = ev('generate', 'done', { start: 640, dur: 2200 });
const verifyActive = ev('llmwiki:verify', 'active', { start: 2900 });
const verifyDone = ev('llmwiki:verify', 'done', { start: 2900, dur: 150 });

export const chatbotGrounded: SurfaceReplay = {
	version: 1,
	surface: 'chatbot',
	provenance: { recordedAt: '2026-08-13', workspace: 'demo' },
	prompt: 'How does v10r keep its AI showcase pages from leaking server internals?',
	frames: [
		{ kind: 'http', status: 200 },
		{ kind: 'meta', pipeline: [overviewActive] },
		{ kind: 'meta', pipeline: [overviewDone, searchActive] },
		{ kind: 'meta', pipeline: [overviewDone, searchDone, docsActive] },
		{ kind: 'meta', pipeline: [overviewDone, searchDone, docsDone, contextActive] },
		{
			kind: 'meta',
			pipeline: [overviewDone, searchDone, docsDone, contextDone],
			promptOutline: {
				blocks: [
					{ id: 'role', tokensEst: 410 },
					{ id: 'completion', tokensEst: 60, conditional: 'hasTools' },
					{ id: 'project-overview', tokensEst: 540 },
					{ id: 'catalog-map', tokensEst: 110 },
					{ id: 'current-page', tokensEst: 20, conditional: 'pageRouteId' },
				],
				totalTokensEst: 1140,
				estimated: true,
			},
		},
		{ kind: 'meta', pipeline: [overviewDone, searchDone, docsDone, contextDone, generateActive] },
		{ kind: 'text', text: 'Showcase pages under a public route never import `$lib/server` — ' },
		{ kind: 'text', text: 'a leak-gate test enforces it, and the data they render is projected from ' },
		{ kind: 'text', text: 'client-safe contract modules instead. ' },
		{
			kind: 'meta',
			pipeline: [overviewDone, searchDone, docsDone, contextDone, generateActive, drillActive],
		},
		{
			kind: 'meta',
			pipeline: [overviewDone, searchDone, docsDone, contextDone, generateActive, drillDone],
		},
		{
			kind: 'text',
			text: 'See /docs/blueprint/auth (leak-gate precedent) and /docs/blueprint/ai/surfaces (the surface contract).',
		},
		{
			kind: 'meta',
			pipeline: [overviewDone, searchDone, docsDone, contextDone, generateDone, drillDone, verifyActive],
		},
		{
			kind: 'meta',
			pipeline: [overviewDone, searchDone, docsDone, contextDone, generateDone, drillDone, verifyDone],
		},
		{ kind: 'finish' },
	],
};
