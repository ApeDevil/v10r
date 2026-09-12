/**
 * Chatbot context assembly — the pre-generation half of a chatbot turn.
 *
 * Everything that decides WHAT enters the chatbot's system prompt lives here:
 * the relevance + deixis + navigation gates, the single shared query embedding, the
 * parallel llmwiki / system-docs / catalog retrieval, and the block-by-block prompt
 * assembly (llmwiki context → project overview → retrieval context → current page →
 * catalog results → catalog map → tool-degrade note).
 *
 * ONE DOOR: the chat orchestrator (real turns) and the context-probe endpoint
 * (`/api/ai/context-probe`, the showcase x-ray) both call this function, so the
 * probe structurally cannot drift from what production does. Telemetry stays
 * with the caller: pass `telemetry` to receive the same pipeline:step /
 * pipeline:chunks events the orchestrator streams to the client.
 */
import type { Locale } from '$lib/i18n';
import { tokenize } from '$lib/search/match';
import type { SearchResult, SearchSurface } from '$lib/search/types';
import { formatLlmwikiContext, type LlmwikiHit, loadOverview, searchLlmwiki } from '$lib/server/llmwiki';
import { formatContextForPrompt, retrieve } from '$lib/server/retrieval';
import { EMBEDDING_DIMENSIONS, PROJECT_DOCS_COLLECTION_ID, SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import { generateEmbedding } from '$lib/server/retrieval/embed';
import type { RetrievalResult } from '$lib/server/retrieval/types';
import { formatCatalogMap, type PageContext } from '$lib/server/search';
import type { ChunkSummary, RetrievalChunksEvent, RetrievalStepEvent } from '$lib/types/retrieval-trace';
import type { EmbeddingConnection } from './connections';
import { formatCurrentPageBlock } from './context/system-prompt';
import { searchCatalogRecords } from './tools/search-catalog';
import type { DocsSeed } from './tools/search-docs';

/** Production system-docs retrieval profile for a chatbot turn. */
export const SYSTEM_DOCS_TIERS: (1 | 2 | 3)[] = [1];
export const SYSTEM_DOCS_MAX_CHUNKS = 4;
/** Verified catalog rows a navigation question gets before generation (`<catalog-results>`). */
export const CATALOG_RESULTS_LIMIT = 5;

/**
 * Relevance gate for the chatbot's system-docs prefetch (user choice: relevance-gated,
 * not always-on). The chatbot is always about v10r, so we prefetch the system-owned docs
 * corpus by default — but skip trivial turns (greetings, acks, very short messages) so an
 * embedding+retrieval round-trip isn't paid when there's no real question to ground. This
 * closes the "fresh user with an empty llmwiki gets zero project knowledge" gap without a
 * per-turn cost on chit-chat.
 */
export function shouldGroundFromSystemDocs(text: string): boolean {
	const t = text.trim();
	if (t.length < 12) return false;
	if (/^(hi|hey|hello|yo|thanks|thank you|ty|ok|okay|k|yes|no|sure|cool|nice|great|lol|hm+)\b[\s!.?]*$/i.test(t)) {
		return false;
	}
	return true;
}

/**
 * Site-awareness deixis gate: does this message point AT the current page ("this", "here",
 * "how does this work", "explain this", "this feature/component/showcase")? Only then do we
 * spend the (already-paid) retrieval embed on a page-seeded query — keeping the page out of
 * the 90% of questions that name their own topic. Deterministic; tune the anchors freely.
 */
export function referencesCurrentPage(text: string): boolean {
	return /\b(this|current)\s+(page|feature|component|showcase|section|demo|example|thing)\b|how (?:does|do) (?:this|it|these)\b|what(?:'s| is| are) (?:this|these|here)\b|explain (?:this|it|the page)\b|on this page\b|\bright here\b/i.test(
		text,
	);
}

/**
 * Navigation-intent gate: does the message ask WHERE something lives, or for a link to it?
 * Such a question is answered by a verified catalog path, which the model could otherwise
 * only obtain by spending a tool step on `search_catalog` — so the assembly runs that search
 * itself, before generation, and puts the rows in the prompt. Deterministic; en/de/ru.
 */
export function wantsNavigation(text: string): boolean {
	return /\b(?:where(?:'s| is| are| can i find| do i find)|links? (?:to|for)|(?:give|send|show) me (?:the |a )?(?:link|page|url)|take me to|wo (?:ist|sind|finde ich)|links? zu|zeig(?:e)? mir)\b|где|ссылк|покажи/i.test(
		text,
	);
}

/** A catalog search distilled from a navigation question: the subject, and the kind of surface named. */
export interface CatalogQuery {
	query: string;
	surface: SearchSurface | null;
}

/** The kind of surface a navigation question names, mapped to the catalog surface it means. */
const SURFACE_WORDS: Record<string, SearchSurface> = {
	showcase: 'showcase',
	showcases: 'showcase',
	component: 'showcase',
	components: 'showcase',
	demo: 'showcase',
	demos: 'showcase',
	komponente: 'showcase',
	компонент: 'showcase',
	демо: 'showcase',
	doc: 'doc',
	docs: 'doc',
	documentation: 'doc',
	doku: 'doc',
	dokumentation: 'doc',
	документация: 'doc',
	документацию: 'doc',
	доки: 'doc',
	blog: 'blog',
	post: 'blog',
	posts: 'blog',
	article: 'blog',
	articles: 'blog',
	artikel: 'blog',
	beitrag: 'blog',
	статья: 'blog',
	статью: 'blog',
	пост: 'blog',
};

/** The asking, not the subject: navigation phrasing and function words the matcher must not see. */
const NAVIGATION_NOISE: ReadonlySet<string> = new Set(
	(
		'where is are was the a an to of for in on at about me my i you it this that and or can could do does find ' +
		'get give go send show take link links url page pages section please how what which want need looking ' +
		'wo ist sind der die das den dem des ein eine einen einem einer zu zum zur über mir mich ich du sie es und ' +
		'oder bitte seite seiten zeig zeige zeigen finde finden gibt kann wie was welche welcher welches ' +
		'где ссылка ссылку ссылки на мне дай дайте покажи покажите найти найду как и или в к у о об про это эта ' +
		'этот эту страница страницу страницы пожалуйста есть можно хочу нужна нужен'
	).split(' '),
);

/**
 * Distil a navigation question into what the catalog's AND-matcher can answer: every token
 * is either a surface word (→ the `surface` facet), noise, or part of the subject. "Where is
 * the auth showcase? Give me the link." → `{ query: 'auth', surface: 'showcase' }`. Null when
 * no subject is left — the model then reaches for `search_catalog` as before.
 */
export function catalogQueryOf(text: string): CatalogQuery | null {
	let surface: SearchSurface | null = null;
	const subject: string[] = [];
	for (const token of tokenize(text)) {
		const facet = SURFACE_WORDS[token];
		if (facet) {
			surface ??= facet;
			continue;
		}
		if (!NAVIGATION_NOISE.has(token)) subject.push(token);
	}
	return subject.length > 0 ? { query: subject.join(' '), surface } : null;
}

const describeError = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/** A pipeline step as authored at a call site — the caller's emit stamps the derived axes. */
type RawStepInput = Omit<RetrievalStepEvent, 'phase' | 'instanceKey' | 'requestId'> & { instanceKey?: string };

/**
 * Caller-supplied telemetry sink. The orchestrator passes its streaming `emit`
 * closure + the turn origin `t0` so retrieval steps land on the turn's shared
 * timeline; the probe endpoint omits it (the report carries its own timings).
 */
export interface AssemblyTelemetry {
	emit: (event: RawStepInput | RetrievalChunksEvent) => void;
	/** Turn origin (`performance.now()`) — one zero for every step's startOffsetMs. */
	t0: number;
}

export interface ChatbotContextInput {
	userId: string;
	/** Text of the fresh user turn (already extracted from the last message). */
	userMsgText: string;
	/** Output of `buildSystemPrompt` for this turn — the cache-stable base. */
	baseSystemPrompt: string;
	/** Optional llmwiki collection scope. `null` means global. */
	collectionId: string | null;
	/** Trusted, server-resolved current page (site-awareness) or null. */
	pageContext: PageContext | null;
	catalogLocale: Locale;
	/** Whether retrieval tools are mounted this turn (drives the honest-degrade note). */
	hasTools: boolean;
	/** Catalog visibility ceiling (`'admin'` · `'user'` · null = public) for the navigation lane. */
	authCeiling?: string | null;
	/**
	 * The request's already-opened Google connection (`registry.embeddingConnection()`), so
	 * the turn's embeds spend no second provider-row read. Absent → the embed path reads
	 * the row itself.
	 */
	embeddingConnection?: EmbeddingConnection;
	/**
	 * Probe mode: widen the system-docs candidate pool beyond the production cutoff.
	 * The PROMPT is still assembled from the top `SYSTEM_DOCS_MAX_CHUNKS` only — rank
	 * order is the choice order, so that prefix is identical to a production retrieve
	 * at the cutoff. The widened tail exists purely so the probe can show what was
	 * available-but-not-chosen. Clamped to at least the production cutoff.
	 */
	docsCandidatePool?: number;
}

/** One assembled prompt block — identity + size, never the text. */
export interface AssembledBlock {
	id:
		| 'role'
		| 'llmwiki-context'
		| 'project-overview'
		| 'retrieval-context'
		| 'current-page'
		| 'page-abstention'
		| 'catalog-results'
		| 'catalog-map'
		| 'tool-degrade';
	/** chars/4 estimate of the injected delta (includes glue text). */
	tokensEst: number;
	/** True when the block's content depends on THIS query/request (vs stable context). */
	dynamic: boolean;
}

export interface ChatbotContextResult {
	/** The fully assembled system prompt, ready for `streamText`. */
	systemPrompt: string;
	/** Enumerable injected context blocks for the Tokens-pane per-block breakdown. */
	promptContextBlocks: { chunkId: string; tokens: number }[];
	/** Did system-docs retrieval return chunks that made it into the prompt? */
	docsGrounded: boolean;
	/**
	 * Did an llmwiki context block enter the prompt? Exactly then the "Retrieval rules" naming
	 * `get_llmwiki_pages` / `get_source_chunks` are in it, and exactly then those tools mount.
	 */
	llmwikiGrounded: boolean;
	/** The per-query routing decisions, exposed for the probe. */
	gates: {
		/** Triviality gate: false → no embed, no retrieval at all this turn. */
		groundDocs: boolean;
		/** Deixis gate: the message points at the current page. */
		wantsPageGrounding: boolean;
		/** Navigation gate: the message asks where something lives, so the catalog was searched. */
		wantsNavigation: boolean;
		/** The actual embed query (page-seeded when the deixis gate fired). */
		docsQuery: string;
	};
	/** llmwiki hits returned by search (all of them — llmwiki has no widened pool). */
	llmwikiHits: LlmwikiHit[];
	/** Full system-docs candidate list (widened in probe mode); [] when gated off. */
	docsCandidates: RetrievalResult['chunks'];
	/** The chunks that actually entered the prompt (top `SYSTEM_DOCS_MAX_CHUNKS`). */
	docsChosen: RetrievalResult['chunks'];
	/** The docs retrieval this turn already paid for — `search_project_docs` reuses it. */
	docsSeed?: DocsSeed;
	/** Verified catalog rows put in front of the model (`<catalog-results>`); [] when none. */
	catalogResults: SearchResult[];
	/** Block-by-block outline of the assembled prompt (ids + sizes, never bodies). */
	blocks: AssembledBlock[];
	/** Per-lane failure messages (a lane can fail while the turn proceeds without it). */
	errors: { llmwiki?: string; docs?: string; catalog?: string };
	/**
	 * Per-lane settle times — each lane's own wall clock, not the barrier's. The wiki and
	 * docs lanes wait for the shared embed, so `llmwikiMs`/`docsMs` include `embedMs`.
	 */
	timings: { embedMs?: number; overviewMs?: number; llmwikiMs?: number; docsMs?: number; catalogMs?: number };
}

/** A lane's own outcome, written the moment it settles and read after the barrier. */
interface LaneSettled {
	ms: number;
	failed: boolean;
	error?: unknown;
}

/**
 * Stamp a lane's own settle time. The four lanes join at one `Promise.allSettled`
 * barrier; measuring after the barrier charges the slowest lane's wait to every lane,
 * which is how a 10 s cold turn read as "everything was slow". The returned promise
 * settles exactly like the input (a rejection is re-thrown), so consumers chain on it.
 */
function settle<T>(p: Promise<T>): { promise: Promise<T>; at: LaneSettled } {
	const at: LaneSettled = { ms: 0, failed: false };
	const started = performance.now();
	const promise = p.then(
		(value) => {
			at.ms = Math.round(performance.now() - started);
			return value;
		},
		(error: unknown) => {
			at.ms = Math.round(performance.now() - started);
			at.failed = true;
			at.error = error;
			throw error;
		},
	);
	return { promise, at };
}

/**
 * Assemble the chatbot system prompt for one turn. Never throws: a failed
 * retrieval lane degrades to a prompt without that lane's context (errors are
 * reported per-lane in the result), mirroring the orchestrator's historical
 * "proceed without context" behavior.
 */
export async function assembleChatbotContext(
	input: ChatbotContextInput,
	telemetry?: AssemblyTelemetry,
): Promise<ChatbotContextResult> {
	const { userId, userMsgText, baseSystemPrompt, collectionId, pageContext, catalogLocale, hasTools } = input;
	const { embeddingConnection, authCeiling = null } = input;
	const emit = telemetry?.emit ?? (() => {});
	const t0 = telemetry?.t0 ?? performance.now();

	let systemPrompt = baseSystemPrompt;
	let docsGrounded = false;
	let llmwikiGrounded = false;
	let docsSeed: DocsSeed | undefined;
	let catalogResults: SearchResult[] = [];
	const wantsPageGrounding = !!pageContext && referencesCurrentPage(userMsgText);
	// Navigation: a "where is…" question is answered by a verified path. The catalog search
	// is embedding-free and independent of every other lane, so it runs alongside them and
	// its rows enter the prompt as `<catalog-results>` — the model answers in one step instead
	// of spending one on `search_catalog` (and, with the raw sentence, often finding nothing).
	const navigation = wantsNavigation(userMsgText);
	const catalogQuery = navigation ? catalogQueryOf(userMsgText) : null;
	const promptContextBlocks: { chunkId: string; tokens: number }[] = [];
	const blocks: AssembledBlock[] = [{ id: 'role', tokensEst: Math.ceil(baseSystemPrompt.length / 4), dynamic: false }];
	const errors: ChatbotContextResult['errors'] = {};
	const timings: ChatbotContextResult['timings'] = {};
	let llmwikiHits: LlmwikiHit[] = [];
	let docsCandidates: RetrievalResult['chunks'] = [];
	let docsChosen: RetrievalResult['chunks'] = [];

	// Relevance-gated system-docs grounding runs in PARALLEL with llmwiki. llmwiki is
	// per-user (empty for a fresh user); the system-owned docs corpus is always there,
	// so this is what guarantees the "v10r expert" answers even with no personal wiki.
	const groundDocs = shouldGroundFromSystemDocs(userMsgText);
	// Site-awareness: when the user points AT the current page ("how does this work?"),
	// the bare message embeds to noise — seed the system-docs query with the resolved
	// page title/breadcrumb so it actually retrieves THIS page's docs. Server-authored
	// text only (the embed query never carries the client string).
	const docsQuery =
		wantsPageGrounding && pageContext
			? `${pageContext.title}. ${pageContext.breadcrumb.join(' ')}. ${userMsgText}`
			: userMsgText;

	/** Measure an injection as a block-outline entry (delta chars → tokens). */
	const pushBlock = (id: AssembledBlock['id'], before: number, dynamic: boolean) => {
		blocks.push({ id, tokensEst: Math.ceil((systemPrompt.length - before) / 4), dynamic });
	};

	try {
		const overviewStart = performance.now();
		emit({
			type: 'pipeline:step',
			step: 'llmwiki:overview',
			status: 'active',
			startOffsetMs: Math.round(overviewStart - t0),
		});
		// Both overview loads are independent of the embed, so they leave first. The
		// system-owned project map grounds broad questions even with an empty personal wiki.
		const overviewLane = settle(loadOverview([userId], collectionId));
		const sysOverviewLane = settle(loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID));
		const searchStart = performance.now();
		emit({
			type: 'pipeline:step',
			step: 'llmwiki:search',
			status: 'active',
			startOffsetMs: Math.round(searchStart - t0),
		});

		// Embed the user message at most ONCE per turn. Letting searchLlmwiki and the
		// system-docs retrieve each embed it independently costs two Gemini calls
		// against the ~1000/day free-tier ceiling for one turn, the second often pure
		// waste (llmwiki is empty in prod). One shared query vector is handed to both.
		// `shouldGroundFromSystemDocs` is a triviality gate, so on
		// greetings/acks (`groundDocs === false`) we skip the embed AND llmwiki search
		// entirely → 0 embeds on chit-chat. A single promise is shared so the provider
		// call fires once; if it rejects (quota/rate 429) BOTH consumers reject, which
		// preserves the prior graceful-degradation traces (llmwiki:search error +
		// system-docs error). On the deixis page-grounding path `docsQuery !== userMsgText`,
		// so retrieve embeds its own page-seeded query independently (in parallel) and does
		// NOT reuse the shared vector — same two-embed cost as before for that rare case.
		const embedStart = performance.now();
		const embedLane = groundDocs ? settle(generateEmbedding(userMsgText, { connection: embeddingConnection })) : null;
		const sharedEmbedPromise: Promise<number[]> | null = embedLane?.promise ?? null;
		if (groundDocs) {
			emit({ type: 'pipeline:step', step: 'embed', status: 'active', startOffsetMs: Math.round(embedStart - t0) });
		}
		const reuseSharedForDocs = docsQuery === userMsgText;

		// Probe widening — never below the production cutoff; the prompt only ever sees
		// the top SYSTEM_DOCS_MAX_CHUNKS regardless of pool size.
		const docsPool = Math.max(input.docsCandidatePool ?? SYSTEM_DOCS_MAX_CHUNKS, SYSTEM_DOCS_MAX_CHUNKS);

		// Make the otherwise-invisible parallel system-docs retrieve a coarse trace lane
		// (one bracketed step, not the engine's sub-steps — those ids collide with llmwiki's).
		const docsStart = performance.now();
		if (groundDocs) {
			emit({
				type: 'pipeline:step',
				step: 'system-docs',
				status: 'active',
				startOffsetMs: Math.round(docsStart - t0),
			});
		}
		const llmwikiCall: Promise<LlmwikiHit[]> = sharedEmbedPromise
			? sharedEmbedPromise.then((emb) => searchLlmwiki(userMsgText, { userId, collectionId, queryEmbedding: emb }))
			: Promise.resolve([]);
		const docsCall: Promise<RetrievalResult | null> = !groundDocs
			? Promise.resolve(null)
			: reuseSharedForDocs && sharedEmbedPromise
				? sharedEmbedPromise.then((emb) =>
						retrieve(docsQuery, {
							userId: SYSTEM_DOCS_USER_ID,
							tiers: SYSTEM_DOCS_TIERS,
							maxChunks: docsPool,
							queryEmbedding: emb,
						}),
					)
				: retrieve(docsQuery, {
						userId: SYSTEM_DOCS_USER_ID,
						tiers: SYSTEM_DOCS_TIERS,
						maxChunks: docsPool,
						embeddingConnection,
					});
		// The wiki and docs lanes chain on the shared embed, so their settle times INCLUDE the
		// embed wait; `embedMs` is that wait on its own.
		const wikiLane = settle(llmwikiCall);
		const docsLane = settle(docsCall);
		const catalogStart = performance.now();
		if (catalogQuery) {
			emit({ type: 'pipeline:step', step: 'catalog', status: 'active', startOffsetMs: Math.round(catalogStart - t0) });
		}
		const catalogLane = catalogQuery
			? settle(
					searchCatalogRecords(catalogQuery.query, {
						locale: catalogLocale,
						authCeiling,
						surface: catalogQuery.surface,
						limit: CATALOG_RESULTS_LIMIT,
					}),
				)
			: null;
		const [overviewResult, hitsResult, docsResult, sysOverviewResult, catalogResult] = await Promise.allSettled([
			overviewLane.promise,
			wikiLane.promise,
			docsLane.promise,
			sysOverviewLane.promise,
			catalogLane?.promise ?? Promise.resolve([] as SearchResult[]),
		]);

		if (catalogLane && catalogQuery) {
			timings.catalogMs = catalogLane.at.ms;
			if (catalogResult.status === 'fulfilled') {
				catalogResults = catalogResult.value;
				emit({
					type: 'pipeline:step',
					step: 'catalog',
					status: 'done',
					durationMs: catalogLane.at.ms,
					detail: { kind: 'catalog', hits: catalogResults.length, surface: catalogQuery.surface },
				});
			} else {
				errors.catalog = describeError(catalogResult.reason);
				emit({
					type: 'pipeline:step',
					step: 'catalog',
					status: 'error',
					durationMs: catalogLane.at.ms,
					error: errors.catalog,
				});
			}
		}

		// The shared embed settled before either consumer could — its lane closes first.
		if (embedLane) {
			timings.embedMs = embedLane.at.ms;
			emit(
				embedLane.at.failed
					? {
							type: 'pipeline:step',
							step: 'embed',
							status: 'error',
							durationMs: embedLane.at.ms,
							error: describeError(embedLane.at.error),
						}
					: {
							type: 'pipeline:step',
							step: 'embed',
							status: 'done',
							durationMs: embedLane.at.ms,
							// No `query`: the trace ships to the client and the text is the user's.
							detail: { kind: 'embed', dimensions: EMBEDDING_DIMENSIONS, reused: false },
						},
			);
		}

		const overviewMs = Math.max(overviewLane.at.ms, sysOverviewLane.at.ms);
		timings.overviewMs = overviewMs;
		if (overviewResult.status === 'fulfilled') {
			emit({ type: 'pipeline:step', step: 'llmwiki:overview', status: 'done', durationMs: overviewMs });
		} else {
			emit({
				type: 'pipeline:step',
				step: 'llmwiki:overview',
				status: 'error',
				durationMs: overviewMs,
				error: overviewResult.reason instanceof Error ? overviewResult.reason.message : String(overviewResult.reason),
			});
		}

		const searchMs = wikiLane.at.ms;
		timings.llmwikiMs = searchMs;
		if (hitsResult.status === 'fulfilled') {
			const hits = hitsResult.value;
			llmwikiHits = hits;
			const pointersHydrated = hits.reduce((sum, h) => sum + h.pointers.length, 0);
			emit({
				type: 'pipeline:step',
				step: 'llmwiki:search',
				status: 'done',
				durationMs: searchMs,
				detail: {
					kind: 'llmwiki-search',
					hits: hits.length,
					vectorHits: hits.length,
					bm25Hits: hits.length,
					pointersHydrated,
					rrfK: 60,
				},
			});
			// Emit llmwiki hits as tierChunks.llmwiki so the viz can render them as pages.
			const llmwikiSummaries: ChunkSummary[] = hits.map((h) => ({
				chunkId: h.slug,
				documentId: h.slug,
				documentTitle: h.title,
				contentPreview: h.tldr,
				contentLength: h.tldr.length,
				score: 0,
				source: 'llmwiki',
				tier: 'llmwiki',
				survived: true,
				dispositionReason: 'pointer-only',
			}));
			emit({
				type: 'pipeline:chunks',
				tierChunks: { llmwiki: llmwikiSummaries },
				rankedChunks: [],
				contextChunks: [],
			});

			const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
			const ctxStart = performance.now();
			emit({
				type: 'pipeline:step',
				step: 'llmwiki:context',
				status: 'active',
				startOffsetMs: Math.round(ctxStart - t0),
			});
			const contextBlock = formatLlmwikiContext(overview, hits);
			const ctxMs = Math.round(performance.now() - ctxStart);
			if (contextBlock) {
				const before = systemPrompt.length;
				systemPrompt = `${baseSystemPrompt}

${contextBlock}

Retrieval rules:
1. Answer from the llmwiki pages above. Their TLDRs and bodies are your primary source.
2. Each page's \`pointers:\` list contains raw chunk IDs (e.g. \`chk_seed_rrf\`). These are the ONLY valid inputs to \`get_source_chunks\`.
3. Call \`get_source_chunks\` ONLY when the user asks for exact wording, a verbatim quote, specific details not in the TLDR, or challenges a claim.
4. When calling \`get_source_chunks\`, you MUST copy chunk IDs verbatim from a page's \`pointers:\` list. NEVER invent, guess, transform, or abbreviate a chunk ID.
5. If no pointer exists for what the user asked, say so plainly instead of fabricating an ID.
6. Do not expand pointers preemptively on broad questions.`;
				pushBlock('llmwiki-context', before, true);
				llmwikiGrounded = true;
			}
			emit({
				type: 'pipeline:step',
				step: 'llmwiki:context',
				status: 'done',
				durationMs: ctxMs,
				detail: {
					kind: 'context',
					tokenEstimate: Math.ceil(contextBlock.length / 4),
					chunkCount: hits.length,
				},
			});
			for (const h of hits) {
				promptContextBlocks.push({ chunkId: h.slug, tokens: Math.ceil(h.tldr.length / 4) });
			}
		} else {
			errors.llmwiki = hitsResult.reason instanceof Error ? hitsResult.reason.message : String(hitsResult.reason);
			emit({
				type: 'pipeline:step',
				step: 'llmwiki:search',
				status: 'error',
				durationMs: searchMs,
				error: errors.llmwiki,
			});
		}

		// System-docs overview anchor — the canonical high-level "what is v10r" map, owned by
		// the system corpus (not the user), so it grounds broad questions even when the user's
		// personal wiki is empty. Always injected when present.
		if (sysOverviewResult.status === 'fulfilled' && sysOverviewResult.value) {
			const before = systemPrompt.length;
			systemPrompt = `${systemPrompt}

<project-overview>
${sysOverviewResult.value.title}

${sysOverviewResult.value.body}
</project-overview>

The <project-overview> above is the canonical high-level map of v10r (a full-stack reference & test-sandbox). Use it to orient broad questions like "what is v10r" or "how do I use it"; ground specifics from the retrieval context and catalog below.`;
			pushBlock('project-overview', before, false);
		}

		// System-docs lane terminal — close the coarse `system-docs` bar (gated on groundDocs;
		// a failure here is the embedding 429 that would otherwise vanish into allSettled).
		// The chosen slice (not the probe-widened pool) drives the telemetry so event
		// semantics don't depend on the caller's pool size.
		const chosen =
			docsResult.status === 'fulfilled' && docsResult.value
				? docsResult.value.chunks.slice(0, SYSTEM_DOCS_MAX_CHUNKS)
				: [];
		if (groundDocs) {
			const docsMs = docsLane.at.ms;
			timings.docsMs = docsMs;
			if (docsResult.status === 'fulfilled') {
				emit({
					type: 'pipeline:step',
					step: 'system-docs',
					status: 'done',
					durationMs: docsMs,
					detail: {
						kind: 'tier',
						tierNumber: 1,
						chunksFound: chosen.length,
						topSources: chosen
							.slice(0, 3)
							.map((c) => ({ title: c.documentTitle, score: Math.round(c.score * 1000) / 1000 })),
					},
				});
			} else {
				errors.docs = docsResult.reason instanceof Error ? docsResult.reason.message : String(docsResult.reason);
				emit({
					type: 'pipeline:step',
					step: 'system-docs',
					status: 'error',
					durationMs: docsMs,
					error: errors.docs,
				});
			}
		}

		// System-docs grounding (relevance-gated, parallel above). Injected regardless of
		// whether llmwiki had hits — this is the coverage net for users with an empty wiki.
		if (docsResult.status === 'fulfilled' && docsResult.value && chosen.length > 0) {
			docsCandidates = docsResult.value.chunks;
			docsChosen = chosen;
			docsSeed = { query: userMsgText, result: docsResult.value };
			const docsBlock = formatContextForPrompt({ ...docsResult.value, chunks: chosen });
			if (docsBlock) {
				docsGrounded = true;
				for (const c of chosen) {
					promptContextBlocks.push({ chunkId: c.chunkId, tokens: Math.ceil(c.content.length / 4) });
				}
				const before = systemPrompt.length;
				systemPrompt = `${systemPrompt}

<retrieval-context>
${docsBlock}
</retrieval-context>

The <retrieval-context> above is retrieved from the project's OWN documentation — treat it as authoritative for how and why v10r is built. The documentation was already searched for the user's question; call \`search_project_docs\` only for a different topic. When you cite a /docs path or link, surface it via \`search_catalog\` (never invent paths).`;
				pushBlock('retrieval-context', before, true);
			}
		}
	} catch (err) {
		console.error('[ai:chat:llmwiki] Retrieval failed, proceeding without context:', err);
	}

	// Site-awareness: passive `<current-page>` block (always-on when the route resolved,
	// soft by framing) so the model can bind "this"/"here" to the page. Honest abstention
	// when the user points at a page we retrieved no docs for — server-driven, not left to
	// the model's self-knowledge. See `docs/blueprint/ai/site-awareness.md`.
	if (pageContext) {
		let before = systemPrompt.length;
		systemPrompt = `${systemPrompt}\n\n${formatCurrentPageBlock(pageContext)}`;
		pushBlock('current-page', before, true);
		if (wantsPageGrounding && !docsGrounded) {
			before = systemPrompt.length;
			systemPrompt = `${systemPrompt}\n\nNo page-specific documentation was retrieved for "${pageContext.title}". Do not fabricate specifics about this page; if the user is asking about it, say plainly you don't have page-specific docs for it, then offer general project knowledge or where to look.`;
			pushBlock('page-abstention', before, true);
		}
	}

	// Navigation grounding — the verified rows the catalog search found for a "where is…"
	// question, paths verbatim. They count as surfaced this turn (chips + verifier) exactly
	// like `search_catalog` output; the rule line makes them citable without a tool step.
	if (catalogResults.length > 0) {
		const before = systemPrompt.length;
		const rows = catalogResults.map(
			(r) => `- [${r.surface}] ${r.title} — ${r.path}${r.anchor ?? ''} (${r.breadcrumb.join(' › ')})`,
		);
		systemPrompt = `${systemPrompt}

<catalog-results>
${rows.join('\n')}
</catalog-results>

The <catalog-results> above are verified catalog results for this turn: cite their paths exactly as written. Call \`search_catalog\` only if none of them is what the user asked for.`;
		pushBlock('catalog-results', before, true);
	}

	// Catalog grounding — always available alongside llmwiki. The search_catalog tool
	// is the ONLY authoritative source of project paths; a compact, path-free map orients
	// the model so it knows the catalog exists and when to reach for it.
	{
		const before = systemPrompt.length;
		systemPrompt = `${systemPrompt}

${formatCatalogMap(catalogLocale)}

Project catalog rules:
1. To find WHERE a page, component/showcase, doc, or blog post lives — or to give the user a link — call \`search_catalog\`. It returns exact canonical paths.
2. Emit a path or link ONLY if it appears verbatim in a catalog or pattern tool result from THIS turn (or a verified llmwiki pointer). NEVER invent or guess a path.
3. If \`search_catalog\` returns nothing for what the user asked, say it isn't in the catalog — do not fabricate a plausible URL.
4. Use \`search_catalog\` for navigation / "what exists"; use the llmwiki pages for explaining how something works.
5. To find which v10r PATTERN covers a capability (and the invariants to preserve when emulating it), call \`search_pattern_library\`; cite its \`/docs/pattern-library/<id>\` page.`;
		pushBlock('catalog-map', before, false);
	}

	// Honest tool degrade. Reached only when EVERY tool-capable provider is cooled, so the
	// retrieval tools referenced above are physically absent this turn. Without this the
	// prompt still orders the model to "call search_catalog", and it happily narrates
	// searches it never ran. Appended before the prompt-assembled event so it is counted.
	if (!hasTools) {
		const before = systemPrompt.length;
		systemPrompt = `${systemPrompt}

NOTE: retrieval tools are unavailable this turn due to provider limits. Do not claim to have searched; answer from the provided context only and say plainly when you cannot verify something.`;
		pushBlock('tool-degrade', before, true);
	}

	return {
		systemPrompt,
		promptContextBlocks,
		docsGrounded,
		llmwikiGrounded,
		gates: { groundDocs, wantsPageGrounding, wantsNavigation: navigation, docsQuery },
		llmwikiHits,
		docsCandidates,
		docsChosen,
		docsSeed,
		catalogResults,
		blocks,
		errors,
		timings,
	};
}
