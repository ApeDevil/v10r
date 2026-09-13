/**
 * Turn trace — the recorded account of one AI turn: what was available, what was
 * considered, what entered each model call, what ran and what the answer cited.
 *
 * ONE contract, three lives:
 *   - recorded on the server while the turn runs (`ai/trace/recorder.ts`), from the
 *     actual execution — never a second run;
 *   - streamed to the client as `message.metadata.trace` (`TurnTraceSnapshot`: every key
 *     always present, bodies withheld) so the status row and the citation chips read it;
 *   - persisted once per turn (`ai.turn` + `ai.model_call` + `ai.tool_call`) and read back
 *     by the turn's owner through `GET /api/ai/conversations/[id]/turns/[messageId]`.
 *
 * Every grounding item carries one of five states. Inclusion never claims influence:
 * `included` means the item was in the request, `cited` means the answer names its path
 * or quotes it. Field names follow the OpenTelemetry GenAI conventions where one exists
 * (`finishReason`, `responseId`, `toolCallId`, `inputTokens`).
 *
 * Framework-free and server-free so the chat components, the showcase inspector and the
 * server recorder all import the same shape.
 */

import type { AiErrorKind } from './ai-error';
import type { ProposalCardStep, ProposalStepReceipt } from './ai-proposal';
import type { CapabilityId, GroundingSourceId } from './assistant-profile';
import type { AiSurface, ProposalStatus } from './db-enums';
import type { RetrieverId } from './retrieval-trace';

/**
 * Where an item stands relative to the answer, in order of commitment:
 * in the profile or corpus → retrieved or ranked this turn → in a model call's request →
 * a tool actually ran and returned it → the answer names its path or quotes it.
 * `available` is the profile manifest's inventory, never a trace item; `executed` is a row a
 * tool execution surfaced (`toolCallId` names it).
 */
export type TurnItemState = 'available' | 'considered' | 'included' | 'executed' | 'cited';

/** A chunk's rung in its document's hierarchy, as `retrieval.chunk.level` records it. */
export type ChunkLevel = 'sentence' | 'paragraph' | 'section';

/**
 * The system-prompt blocks either surface assembles. A capability's guidance block is
 * `<capability>-guidance`; the other ids name the block's content (its XML tag, mostly).
 */
export type PromptBlockId =
	| 'role'
	| 'completion-guidance'
	| 'project-map-guidance'
	| 'project-docs-guidance'
	| 'catalog-guidance'
	| 'navigation-guidance'
	| 'pattern-library-guidance'
	| 'desk-awareness-guidance'
	| 'desk-files-guidance'
	| 'desk-edit-guidance'
	| 'desk-create-guidance'
	| 'desk-ask-guidance'
	| 'desk-plan-guidance'
	| 'project-overview'
	| 'catalog-map'
	| 'permissions'
	| 'workspace'
	| 'desk-context'
	| 'desk-layout'
	| 'current-page'
	| 'retrieval-context'
	| 'catalog-results'
	| 'planning'
	| 'page-abstention'
	| 'tool-degrade';

/**
 * What a block is for: who the assistant is, how it uses what it has, retrieved material,
 * the user's situation, or detail injected because a rule fired.
 */
export type PromptBlockSection = 'identity' | 'guidance' | 'grounding' | 'awareness' | 'guide';

/** One assembled system-prompt block, with the text as sent. */
export interface PromptBlock {
	id: PromptBlockId;
	/** The capability that owns the block; absent on the identity block. */
	capability?: CapabilityId;
	section: PromptBlockSection;
	/** The block's text as sent. Withheld on the streamed snapshot (`bodies: 'persisted'`). */
	text?: string;
	chars: number;
	/** True when the text does not depend on this request — the cache-stable prefix. */
	stable: boolean;
}

export type PromptBlockOutline = Omit<PromptBlock, 'text'>;

/**
 * Why a grounding source did not run this turn: its capability's rule did not fire, the
 * message was trivial (greeting, ack), the desk scope is off, or the corpus is empty.
 */
export type GroundingSkipReason = 'gated_off' | 'trivial' | 'scope_off' | 'empty_corpus' | 'indexing';

/**
 * How an item's body is resolved at read time: a retrieval chunk (by id from
 * `retrieval.chunk`), a catalog row (the row is the whole item), or a corpus map (by id
 * from `retrieval.corpus_map`).
 */
export type GroundingItemKind = 'chunk' | 'catalog' | 'map';

/** A catalog row's presentation, as a citation chip renders it. */
export interface CatalogItemView {
	surface: 'page' | 'showcase' | 'section' | 'doc' | 'blog';
	anchor: string | null;
	breadcrumb: string[];
	icon?: string;
	badge: 'en-fallback' | null;
	locale: string;
}

/** One candidate a grounding source produced this turn. */
export interface GroundingItem {
	id: string;
	kind: GroundingItemKind;
	documentId?: string;
	title: string;
	score?: number;
	/** Rank within the source's candidate list (0-based). */
	rank: number;
	state: TurnItemState;
	/** Hash of the body at the time of the turn (tier-1 chunks); a read-time mismatch marks `drifted`. */
	contentHash?: string;
	chars?: number;
	/** Recorded ancestry (tier-1 chunks): the parent chunk, the chunk's level and its position in the document. */
	parentId?: string;
	level?: ChunkLevel;
	position?: number;
	/** Which retriever produced it this turn. */
	retriever?: RetrieverId;
	/** The prompt block that carried it, when it entered the system prompt. */
	blockId?: PromptBlockId;
	/** Why a considered item stayed out of the prompt: ranked past the cutoff, or cut by the size cap. */
	omittedReason?: 'below_cutoff' | 'size_cap';
	/** Tool-surfaced rows: the tool call whose result carried this item to the model. */
	toolCallId?: string;
	/** Catalog rows, doc pages and doc chunks: the canonical path the answer would cite. */
	path?: string;
	catalog?: CatalogItemView;
	/** Read side only: the body, resolved by id for the turn's owner. */
	body?: string;
	/** Read side only: the live body no longer matches `contentHash`. */
	drifted?: boolean;
	/**
	 * Read side only: the parent chunk as it stands NOW (current metadata, never the turn's
	 * account); absent when `parentId` is not readable any more.
	 */
	parent?: { level: ChunkLevel; position: number; chars: number };
}

/** One grounding source's account of the turn. */
export interface GroundingSource {
	id: GroundingSourceId;
	ran: boolean;
	skippedReason?: GroundingSkipReason;
	error?: string;
	/** Candidates requested from the source. */
	pool?: number;
	/** How many of them the prompt takes at most. */
	cutoff?: number;
	/** For a map source: the character offset at which the body was cut for the prompt. */
	truncatedAt?: number;
	/** The retrievers that ran for this source this turn (a lane that only reads a map has none). */
	retrievers?: RetrieverId[];
	items: GroundingItem[];
	startOffsetMs?: number;
	ms?: number;
}

/** Whether a capability was in play this turn — its own rule's verdict, with the reason when not. */
export interface Activation {
	id: CapabilityId;
	active: boolean;
	reason?: string;
}

/** A desk panel handed to the prompt — identity and size; its body is in the `desk-context` block. */
export interface AwarenessPanel {
	panelType: string;
	label: string;
	fileId?: string;
	fileType?: string;
	chars: number;
	truncated?: boolean;
	dirty?: boolean;
}

/** What the assistant was told about the user's situation this turn. */
export interface TurnAwareness {
	locale: string;
	authCeiling: 'admin' | 'user' | null;
	/** Chatbot: the resolved, allowlisted public page the question was asked from. */
	page?: { path: string; title: string; surface: string } | null;
	/** Deskbot: the consent scopes the user switched on. */
	scopes?: string[];
	workspace?: { id: string; name: string } | null;
	layout?: { panelId: string; fileId?: string; fileType?: string; label: string }[];
	panels?: AwarenessPanel[];
}

/** One part of a history message as sent, sized but never quoted. */
export interface HistoryPart {
	type: 'text' | 'tool_call' | 'tool_call_response' | 'reasoning' | 'compaction' | 'file' | 'other';
	chars: number;
	toolName?: string;
	/** A compacted tool result: the ref the model can resolve. */
	ref?: string;
}

export interface HistoryMessage {
	role: 'user' | 'assistant' | 'tool' | 'system';
	parts: HistoryPart[];
}

/** The windowed conversation history as sent to the first model call. */
export interface TurnHistory {
	messages: HistoryMessage[];
	/** Messages the window dropped from the client's full thread. */
	droppedMessages: number;
}

/** A tool definition as the model received it. */
export interface ToolDefinitionRecord {
	name: string;
	description: string;
	inputSchema: unknown;
}

/** What one provider request carried. */
export interface ModelCallRequest {
	systemHash: string;
	blockIds: PromptBlockId[];
	/** Messages in the request (history plus the earlier steps' tool round trips). */
	historyCount: number;
	/**
	 * The tool calls whose results are in the request — the earlier steps' round trips, by
	 * `toolCallId`. Absent on calls recorded before the field existed (not recorded); empty when none.
	 */
	toolResultIds?: string[];
	toolsOffered: string[];
	activeTools?: string[];
	toolChoice?: string;
	providerOptions?: Record<string, unknown>;
}

/** What one provider request answered. */
export interface ModelCallResponse {
	responseId?: string;
	responseModel?: string;
	finishReason?: string;
	textChars: number;
	toolCalls: { toolCallId: string; toolName: string }[];
	warnings?: string[];
	cacheReadTokens?: number;
	reasoningTokens?: number;
	/** ms from the call's start to its first streamed token (text, reasoning or tool input). */
	firstTokenMs?: number;
}

export type ModelCallOutcome = 'ok' | 'error' | 'cancelled';

/** One provider request: attempt × step. */
export interface ModelCallRecord {
	id: string;
	attemptIndex: number;
	stepIndex: number;
	providerId: string | null;
	modelId: string | null;
	inputTokens: number;
	outputTokens: number;
	durationMs: number | null;
	startOffsetMs?: number;
	request: ModelCallRequest;
	response: ModelCallResponse | null;
	outcome: ModelCallOutcome;
}

export type ToolExecutionStatus = 'success' | 'error' | 'requires_approval';

/** One tool `execute`. `output` is what the model saw — post-compaction, size-capped. */
export interface ToolExecutionRecord {
	id: string;
	toolCallId: string;
	toolName: string;
	/** Order of execution within the turn (0-based). */
	ordinal: number;
	modelCallId?: string;
	input?: unknown;
	output?: unknown;
	status: ToolExecutionStatus;
	errorMessage?: string;
	durationMs?: number;
	startOffsetMs?: number;
	/** Set when the result was compacted: the ref `resolve_ref` pulls back and its original size. */
	compaction?: { ref: string; originalBytes: number } | null;
}

export type ToolExecutionOutline = Omit<ToolExecutionRecord, 'input' | 'output'>;

export type AttemptOutcome = 'started' | 'ok' | 'rotated' | 'failed' | 'cancelled';

/** One provider attempt of the turn's rotation. */
export interface AttemptRecord {
	attemptIndex: number;
	providerId: string | null;
	modelId: string | null;
	outcome: AttemptOutcome;
	errorKind?: AiErrorKind;
	/** Content parts the client had received when the attempt ended. */
	contentParts?: number;
}

/**
 * How the answer refers to a source: names its path, quotes it verbatim, carries the
 * provider's own citation — or names a path nothing this turn produced (`unsurfaced`: the
 * answer's claim, not the turn's).
 */
export type CitationMatch = 'path' | 'quote' | 'provider_source' | 'unsurfaced';

/** A deterministic fact tying the answer to a grounding item, or to a path no item backs. */
export interface CitationRecord {
	/** The grounding item; for `unsurfaced`, the path itself. */
	itemId: string;
	source: GroundingSourceId;
	match: CitationMatch;
	path?: string;
	quote?: string;
	answerStart?: number;
	answerEnd?: number;
	/** `unsurfaced` only: the path does exist in the catalog (recalled, not grounded) vs. not at all. */
	known?: boolean;
}

export type TurnOutcome = 'ok' | 'error' | 'cancelled' | 'awaiting_decision';

/**
 * The proposal a deskbot turn stopped on, resolved by `proposalId` at read time for the
 * turn's owner: the plan as the user reviewed it, where its lifecycle stands, the consent
 * scopes frozen with it, and the receipts of what the approval replay ran. The turn records
 * the id only — the proposal keeps moving after the turn (approved, executed, expired).
 */
export interface TurnProposal {
	id: string;
	status: ProposalStatus;
	riskTier: 'low' | 'medium' | 'high';
	goal: string;
	steps: ProposalCardStep[];
	/** The scopes granted when the plan was proposed — what the approval replays under. */
	grantedScopes: string[];
	/** One per executed step, in execution order; a planned step without one never ran. */
	receipts: ProposalStepReceipt[];
	failureMessage: string | null;
	expiresAt: string;
	approvedAt: string | null;
	executedAt: string | null;
}

export interface TurnTimings {
	/** Orchestrator entry → the `start` frame: what the client waits on before any frame. */
	preStreamMs?: number;
	embedMs?: number;
	generateMs?: number;
	/** Per model call, ms to its first streamed token. */
	firstTokenMs?: number[];
	/** Post-text work while the message is still open, per stage (absent = stage skipped). */
	finalize?: { catalogMs?: number; persistMs?: number; budgetMs?: number };
}

/** Where the trace's bodies (block text, tool I/O) are. */
export type TurnTraceBodies = 'inline' | 'persisted' | 'redacted';

/** The full trace of one turn, as persisted and as read back by its owner. */
export interface TurnTrace {
	/** The assistant message the turn produced — the turn's key. */
	messageId: string;
	conversationId: string | null;
	surface: AiSurface;
	requestId: string;
	/** Hash of identity + guidance + tool definitions: proves prefix stability across turns. */
	profileVersion: string;
	outcome: TurnOutcome;
	errorKind: AiErrorKind | null;
	timings: TurnTimings;
	awareness: TurnAwareness;
	activations: Activation[];
	blocks: PromptBlock[];
	grounding: GroundingSource[];
	history: TurnHistory;
	/** The tool definitions offered this turn, once; model calls list names. */
	toolset: ToolDefinitionRecord[];
	modelCalls: ModelCallRecord[];
	toolExecutions: ToolExecutionRecord[];
	attempts: AttemptRecord[];
	citations: CitationRecord[];
	/** The proposal this turn stopped on, when it did. */
	proposalId: string | null;
	/** Read side only: the proposal behind `proposalId`, resolved for the turn's owner. */
	proposal?: TurnProposal;
	createdAt: string;
	bodies: TurnTraceBodies;
}

/**
 * The trace as streamed on `message.metadata.trace`: the same keys, always all present
 * (the client deep-merges metadata objects, so a key that vanished would linger), with
 * block text, tool I/O and the tool definitions withheld — the inspector fetches them by id.
 */
export interface TurnTraceSnapshot
	extends Omit<TurnTrace, 'blocks' | 'toolset' | 'toolExecutions' | 'bodies' | 'createdAt' | 'proposal'> {
	blocks: PromptBlockOutline[];
	toolExecutions: ToolExecutionOutline[];
	bodies: 'persisted';
}

/** One row of a conversation's turn list — enough to show chips and open the inspector. */
export interface TurnSummary {
	messageId: string;
	surface: AiSurface;
	outcome: TurnOutcome;
	activations: Activation[];
	citations: CitationRecord[];
	/** Cited catalog items, so a reloaded thread renders its chips without the full trace. */
	cited: GroundingItem[];
	modelCalls: number;
	toolExecutions: number;
	createdAt: string;
}
