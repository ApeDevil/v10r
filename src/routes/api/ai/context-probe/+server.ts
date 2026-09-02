/**
 * POST /api/ai/context-probe — the context-orchestration x-ray behind
 * `/showcases/ai/{chatbot,deskbot}#probe`.
 *
 * Runs the pre-generation half of a turn — the SAME gates, retrieval, and
 * prompt assembly a real turn runs (`context-assembly.ts` for the chatbot,
 * `buildSystemPromptBlocks` + the plan governor for the deskbot) — and returns
 * a structured report: what each corpus had available, what the ranker chose
 * (with the production cutoff marked), and which prompt blocks are static vs
 * dynamically ingested for THIS query. It NEVER calls the LLM: worst-case cost
 * is one query embedding plus a few DB counts, and corpora whose gate closes
 * (trivial query, empty corpus, missing scope) spend nothing at all.
 *
 * Guarded like every other AI endpoint (`guardAiRequest`: auth → aiConfigured
 * → rate limit → daily budget) — the embedding quota is the scarce resource.
 * The report is client-safe by construction (`$lib/types/context-probe.ts`):
 * ids, counts, scores, and short previews; never prompt bodies.
 */
import { safeParse } from 'valibot';
import type { Locale } from '$lib/i18n';
import { buildSystemPromptBlocks } from '$lib/server/ai/context/system-prompt';
import { assembleChatbotContext, SYSTEM_DOCS_MAX_CHUNKS } from '$lib/server/ai/context-assembly';
import { DESK_SEARCH_MAX_CHUNKS, retrieveDeskDocs } from '$lib/server/ai/deskbot-retrieval';
import { guardAiRequest } from '$lib/server/ai/guard';
import { hasDestructiveIntent, shouldRequirePlan } from '$lib/server/ai/policy';
import { ContextProbeRequestSchema } from '$lib/server/ai/validation';
import { countCorpus } from '$lib/server/db/retrieval/queries';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { apiError, apiOk, apiValidationError } from '$lib/server/http/response';
import { countPages, LLMWIKI_SEARCH_LIMIT } from '$lib/server/llmwiki';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import { resolvePageContext } from '$lib/server/search';
import { type DeskToolScope, TOOL_MANIFEST } from '$lib/types/ai-tools';
import type { ProbeCandidate, ProbeCorpusResult, ProbeReport } from '$lib/types/context-probe';
import type { RequestHandler } from './$types';

/**
 * Widened candidate pool so the report can show what ranked BELOW the production
 * cutoff. Rank order is the choice order, so the top-of-pool prefix is exactly
 * the set a real turn would have chosen.
 */
const PROBE_CANDIDATE_POOL = 12;

const PREVIEW_CHARS = 200;

const preview = (text: string) => (text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text);

async function probeChatbot(
	userId: string,
	query: string,
	pageRouteId: string | undefined,
	locale: Locale,
): Promise<ProbeReport> {
	// Same trust boundary as the chatbot route: the raw route id resolves against
	// the public catalog here and is discarded on miss.
	const pageContext = resolvePageContext(pageRouteId, locale);

	const [assembly, wikiPages, docsCorpus] = await Promise.all([
		assembleChatbotContext({
			userId,
			userMsgText: query,
			// The chatbot's base prompt: no desk scopes → role block only.
			baseSystemPrompt: buildSystemPromptBlocks({})
				.map((b) => b.text)
				.join('\n\n'),
			collectionId: null,
			pageContext,
			catalogLocale: locale,
			hasTools: true,
			docsCandidatePool: PROBE_CANDIDATE_POOL,
		}),
		countPages([userId], null),
		countCorpus(SYSTEM_DOCS_USER_ID, 'docs'),
	]);

	const chosenIds = new Set(assembly.docsChosen.map((c) => c.chunkId));
	const docsCorpusResult: ProbeCorpusResult = {
		corpus: 'docs',
		ran: assembly.gates.groundDocs && !assembly.errors.docs,
		cutoff: SYSTEM_DOCS_MAX_CHUNKS,
		candidates: assembly.docsCandidates.map(
			(c): ProbeCandidate => ({
				title: c.documentTitle,
				preview: preview(c.content),
				score: Math.round(c.score * 1000) / 1000,
				source: c.source,
				tier: String(c.tier),
				chosen: chosenIds.has(c.chunkId),
			}),
		),
	};
	if (!assembly.gates.groundDocs) docsCorpusResult.skippedReason = 'gated_off';
	if (assembly.errors.docs) docsCorpusResult.error = 'retrieval_failed';

	const llmwikiCorpusResult: ProbeCorpusResult = {
		corpus: 'llmwiki',
		ran: assembly.gates.groundDocs && !assembly.errors.llmwiki,
		cutoff: LLMWIKI_SEARCH_LIMIT,
		// Every returned hit enters the context (TLDRs + pointers) — chosen by construction.
		candidates: assembly.llmwikiHits.map(
			(h): ProbeCandidate => ({
				title: h.title,
				preview: preview(h.tldr),
				source: 'llmwiki',
				tier: 'llmwiki',
				chosen: true,
			}),
		),
	};
	if (!assembly.gates.groundDocs) llmwikiCorpusResult.skippedReason = 'gated_off';
	if (assembly.errors.llmwiki) llmwikiCorpusResult.error = 'retrieval_failed';

	return {
		surface: 'chatbot',
		gates: [
			{ id: 'ground_docs', fired: assembly.gates.groundDocs },
			{ id: 'page_deixis', fired: assembly.gates.wantsPageGrounding },
		],
		inventory: [
			{ corpus: 'llmwiki', documents: wikiPages },
			{ corpus: 'docs', documents: docsCorpus.documents, chunks: docsCorpus.chunks },
		],
		tools: TOOL_MANIFEST.filter((t) => t.surface === 'chatbot').map((t) => t.name),
		corpora: [llmwikiCorpusResult, docsCorpusResult],
		prompt: {
			blocks: assembly.blocks.map((b) => ({ id: b.id, tokensEst: b.tokensEst, dynamic: b.dynamic })),
			totalTokensEst: Math.ceil(assembly.systemPrompt.length / 4),
		},
		docsQuery: assembly.gates.docsQuery,
	};
}

async function probeDeskbot(
	userId: string,
	query: string,
	toolScopes: DeskToolScope[] | undefined,
): Promise<ProbeReport> {
	// Default to every scope granted — the pedagogically interesting configuration
	// (the plan governor can actually fire). The UI sends real toggles.
	const scopes: DeskToolScope[] = toolScopes?.length
		? toolScopes
		: ['desk:read', 'desk:write', 'desk:create', 'desk:delete', 'desk:ask'];
	const destructiveIntent = hasDestructiveIntent(query);
	const mutatingScopeGranted = scopes.some((s) => s === 'desk:write' || s === 'desk:create' || s === 'desk:delete');
	const requirePlan = shouldRequirePlan({ mutatingScopeGranted, destructiveIntent });

	// The deskbot's base prompt for this scope set — same shared builder as a real turn.
	// The probe is not a desk session: panel/layout/workspace blocks are honestly absent.
	const blocks = buildSystemPromptBlocks({ toolScopes: [...scopes], requirePlan });

	const deskCorpus = await countCorpus(userId, 'desk');

	// Mirror `desk_search_knowledge` (`desk:ask` scope): skip without the scope
	// (tool not mounted) or on an empty corpus (no embedding spent either way).
	const deskCorpusResult: ProbeCorpusResult = {
		corpus: 'desk',
		ran: false,
		cutoff: DESK_SEARCH_MAX_CHUNKS,
		candidates: [],
	};
	if (!scopes.includes('desk:ask')) {
		deskCorpusResult.skippedReason = 'scope_off';
	} else if (deskCorpus.documents === 0) {
		deskCorpusResult.skippedReason = 'empty_corpus';
	} else {
		try {
			const result = await retrieveDeskDocs(userId, query, PROBE_CANDIDATE_POOL);
			deskCorpusResult.ran = true;
			deskCorpusResult.candidates = result.chunks.map(
				(c, i): ProbeCandidate => ({
					title: c.documentTitle,
					preview: preview(c.content),
					score: Math.round(c.score * 1000) / 1000,
					source: c.source,
					tier: String(c.tier),
					chosen: i < DESK_SEARCH_MAX_CHUNKS,
				}),
			);
		} catch (err) {
			console.error('[api:ai:context-probe] Desk retrieval failed:', err instanceof Error ? err.message : err);
			deskCorpusResult.error = 'retrieval_failed';
		}
	}

	return {
		surface: 'deskbot',
		gates: [{ id: 'require_plan', fired: requirePlan, inputs: { mutatingScopeGranted, destructiveIntent } }],
		inventory: [{ corpus: 'desk', documents: deskCorpus.documents, chunks: deskCorpus.chunks }],
		// Deskbot mounting IS scope-dependent: only tools whose scope is granted exist this turn.
		tools: TOOL_MANIFEST.filter((t) => t.surface === 'deskbot' && scopes.includes(t.scope)).map((t) => t.name),
		corpora: [deskCorpusResult],
		prompt: {
			blocks: blocks.map((b) => ({
				id: b.id,
				tokensEst: Math.ceil(b.text.length / 4),
				// Static context = same regardless of query/request; the planning block is
				// query-triggered and permissions vary per grant set.
				dynamic: b.id === 'planning' || b.id === 'permissions',
			})),
			totalTokensEst: Math.ceil(blocks.reduce((sum, b) => sum + b.text.length + 2, 0) / 4),
		},
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = await guardAiRequest(locals);
	if (guard.response) return guard.response;

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}

	const parsed = safeParse(ContextProbeRequestSchema, read.value);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const locale = (locals.locale ?? 'en') as Locale;
	try {
		const report =
			parsed.output.surface === 'chatbot'
				? await probeChatbot(guard.user.id, parsed.output.query, parsed.output.pageRouteId, locale)
				: await probeDeskbot(guard.user.id, parsed.output.query, parsed.output.toolScopes);
		return apiOk(report);
	} catch (err) {
		console.error('[api:ai:context-probe] Error:', err instanceof Error ? err.message : err);
		return apiError(500, 'probe_failed', 'Context probe failed.');
	}
};
