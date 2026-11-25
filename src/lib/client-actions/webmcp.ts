/**
 * WebMCP adapter — the same client actions, offered to the browser's own agent.
 *
 * The in-app assistant reaches a client action through its turn's response stream
 * (`docs/blueprint/ai/agent-actions.md`). A browser that implements WebMCP
 * (`document.modelContext`, Chrome origin trial 149–156 in 2026-11, W3C Web Machine Learning
 * CG incubation) lets an agent that is NOT ours — the browser's assistant, an extension —
 * call registered page tools instead of reading pixels and simulating clicks. This module
 * publishes contracts that already exist to that API; it adds no action, no schema and no
 * permission of its own:
 *
 * - the tool's input schema is the contract's valibot schema, converted once;
 * - `execute` is `runner.run()`, so validation, the mounted-handler check, the timeout, the
 *   read-back and the bounded `ClientActionResult` are the ones the in-app agent gets;
 * - only actions whose catalogue risk is `read` or `view` can be published (fail closed): a
 *   tool that changes stored data stays a server tool behind the approval gate, whoever asks;
 * - the catalogue decides a known action's risk; a page may raise it, never lower it, and
 *   only genuinely page-local actions take their risk from the page;
 * - nothing is published without the user's explicit consent, and a catalogued action's
 *   scope must be one the user holds;
 * - a call budget per minute bounds an external agent that loops;
 * - the agent gets the status and code of each call; what the screen showed (`observed`)
 *   only for actions the page names in `shareObserved`;
 * - results are marked `untrustedContentHint` — they describe the user's screen;
 * - nothing is published unless the feature exists (`'modelContext' in document`), and every
 *   registration is withdrawn through one `AbortSignal` when the caller disposes.
 *
 * Progressive enhancement only: no polyfill ships, no page depends on it, and a browser
 * without WebMCP runs exactly the code it ran before.
 */
import { toJsonSchema } from '@valibot/to-json-schema';
import { TOOL_MANIFEST, type ToolRisk } from '#lib/types/ai-tools.ts';
import type { ClientActionContract, ClientActionResult } from './contract';
import type { ClientActionRunner } from './runner';

/** The slice of the WebMCP imperative API this adapter uses (`document.modelContext`). */
export interface WebMcpModelContext {
	registerTool(
		tool: {
			name: string;
			description: string;
			inputSchema: unknown;
			annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean };
			execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>;
		},
		options?: { signal?: AbortSignal },
	): unknown;
}

/** Catalogue risks a published action may carry. Everything else stays in-app or server-side. */
const PUBLISHABLE_RISKS: readonly ToolRisk[] = ['read', 'view'];

/** Risk order, least consequential first — a page may raise a catalogued risk, never lower it. */
const RISK_ORDER: readonly ToolRisk[] = ['read', 'view', 'create', 'write', 'destructive'];

/** Calls an external agent may make per minute across every published action. */
export const WEBMCP_CALLS_PER_MINUTE = 30;

export interface WebMcpPublication {
	/**
	 * The user's explicit opt-in for THIS page and session ("let browser agents use this
	 * page"). Nothing is published without it: an agent in the browser is a different party
	 * from the in-app assistant the user is talking to.
	 */
	consent: boolean;
	/** One human-readable sentence per action, what the browser agent is told. */
	descriptions: Record<string, string>;
	/**
	 * Risks for genuinely page-local actions — ones `TOOL_MANIFEST` does not know (a showcase's
	 * own actions). For a catalogued action the catalogue decides: a page-local entry may only
	 * restate or raise it; a lower one refuses the action (`risk_conflicts_with_catalogue`).
	 */
	risks?: Record<string, ToolRisk>;
	/** The scopes this user holds on this page. A catalogued action with a scope outside it is refused. */
	grantedScopes?: readonly string[];
	/**
	 * Actions whose `observed` facts may be returned to the browser agent. Default: none — the
	 * agent learns the status and code, not what the screen shows, unless the page says so.
	 */
	shareObserved?: readonly string[];
	/** Defaults to `document.modelContext` when it exists. */
	modelContext?: WebMcpModelContext | null;
	now?: () => number;
}

export type WebMcpRefusalReason =
	| 'no_consent'
	| 'unknown_risk'
	| 'risk_conflicts_with_catalogue'
	| 'risk_not_publishable'
	| 'scope_not_granted'
	| 'no_description'
	| 'already_published';

export interface WebMcpExposure {
	/** The action names actually published — empty when the browser has no WebMCP. */
	published: string[];
	/** Action names refused, with the reason. */
	refused: { name: string; reason: WebMcpRefusalReason }[];
	/** Withdraw every registration. Idempotent; a call that arrives afterwards is refused. */
	dispose(): void;
}

/** Feature detection, never a polyfill. */
export function detectModelContext(): WebMcpModelContext | null {
	if (typeof document === 'undefined') return null;
	const context = (document as unknown as { modelContext?: WebMcpModelContext }).modelContext;
	return context && typeof context.registerTool === 'function' ? context : null;
}

type RiskDecision = { ok: true; risk: ToolRisk } | { ok: false; reason: WebMcpRefusalReason };

/**
 * The effective risk of one action: the catalogue's when it knows the action (a page-local
 * declaration may raise it, never lower it), the page's only for actions the catalogue does
 * not know.
 */
export function webMcpRiskOf(name: string, pageRisks: Record<string, ToolRisk> | undefined): RiskDecision {
	const catalogued = TOOL_MANIFEST.find((d) => d.name === name);
	const declared = pageRisks?.[name];
	if (!catalogued) return declared ? { ok: true, risk: declared } : { ok: false, reason: 'unknown_risk' };
	if (!declared) return { ok: true, risk: catalogued.risk };
	if (RISK_ORDER.indexOf(declared) < RISK_ORDER.indexOf(catalogued.risk)) {
		return { ok: false, reason: 'risk_conflicts_with_catalogue' };
	}
	return { ok: true, risk: declared };
}

function scopeOf(name: string): string | undefined {
	const catalogued = TOOL_MANIFEST.find((d) => d.name === name);
	return catalogued && 'scope' in catalogued ? catalogued.scope : undefined;
}

/** Names published per model context, so two lifecycles on one page cannot double-register. */
const publishedByContext = new WeakMap<WebMcpModelContext, Set<string>>();

let exposureSequence = 0;

/**
 * Publish `contracts` through WebMCP. Each call becomes `runner.run()` with a call id unique
 * to this exposure, so an external agent's duplicate call is two calls (it has no tool-call
 * id of ours), and the budget — not dedup — is what bounds it; two exposures can never share
 * a runner's dedup entry.
 */
export function exposeClientActionsToWebMcp(
	runner: ClientActionRunner,
	contracts: readonly ClientActionContract[],
	publication: WebMcpPublication,
): WebMcpExposure {
	const context = publication.modelContext === undefined ? detectModelContext() : publication.modelContext;
	const refused: WebMcpExposure['refused'] = [];
	const published: string[] = [];
	const lifetime = new AbortController();
	const now = publication.now ?? Date.now;
	const recentCalls: number[] = [];
	const shareObserved = new Set(publication.shareObserved ?? []);
	const granted = new Set(publication.grantedScopes ?? []);
	exposureSequence += 1;
	const exposureId = exposureSequence;
	let callSequence = 0;

	const overBudget = (): boolean => {
		const cutoff = now() - 60_000;
		while (recentCalls.length > 0 && recentCalls[0] < cutoff) recentCalls.shift();
		if (recentCalls.length >= WEBMCP_CALLS_PER_MINUTE) return true;
		recentCalls.push(now());
		return false;
	};

	const registered = context ? (publishedByContext.get(context) ?? new Set<string>()) : new Set<string>();
	if (context) publishedByContext.set(context, registered);

	for (const contract of contracts) {
		if (!publication.consent) {
			refused.push({ name: contract.name, reason: 'no_consent' });
			continue;
		}
		const decision = webMcpRiskOf(contract.name, publication.risks);
		if (!decision.ok) {
			refused.push({ name: contract.name, reason: decision.reason });
			continue;
		}
		const risk = decision.risk;
		if (!PUBLISHABLE_RISKS.includes(risk)) {
			refused.push({ name: contract.name, reason: 'risk_not_publishable' });
			continue;
		}
		const scope = scopeOf(contract.name);
		if (scope && !granted.has(scope)) {
			refused.push({ name: contract.name, reason: 'scope_not_granted' });
			continue;
		}
		const description = publication.descriptions[contract.name];
		if (!description) {
			refused.push({ name: contract.name, reason: 'no_description' });
			continue;
		}
		if (!context) continue;
		if (registered.has(contract.name)) {
			refused.push({ name: contract.name, reason: 'already_published' });
			continue;
		}
		registered.add(contract.name);
		const name = contract.name;
		context.registerTool(
			{
				name,
				description,
				inputSchema: toJsonSchema(contract.input, { errorMode: 'ignore' }),
				annotations: { readOnlyHint: risk === 'read', untrustedContentHint: true, consequentialHint: false },
				async execute(input, options): Promise<ClientActionResult> {
					if (lifetime.signal.aborted) {
						return { status: 'unavailable', code: 'unpublished', message: 'This action is no longer offered.' };
					}
					if (options?.signal?.aborted) {
						return { status: 'refused', code: 'cancelled', message: 'The caller cancelled before it ran.' };
					}
					if (overBudget()) {
						return {
							status: 'refused',
							code: 'budget_exhausted',
							message: `At most ${WEBMCP_CALLS_PER_MINUTE} actions per minute.`,
						};
					}
					callSequence += 1;
					const result = await runner.run({ callId: `webmcp_${exposureId}_${callSequence}`, name, input });
					if (shareObserved.has(name) || result.observed === undefined) return result;
					const { observed: _withheld, ...withoutObserved } = result;
					return withoutObserved;
				},
			},
			{ signal: lifetime.signal },
		);
		published.push(name);
	}

	return {
		published,
		refused,
		dispose: () => {
			if (lifetime.signal.aborted) return;
			lifetime.abort();
			for (const name of published) registered.delete(name);
		},
	};
}
