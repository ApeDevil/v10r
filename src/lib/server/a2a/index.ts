/**
 * A2A (Agent2Agent, spec 1.0) — v10r's architecture review agent and the client that delegates
 * reviews to peer agents. Deterministic on both sides: no language model, no API keys.
 *
 * Server leg: `buildArchitectureReviewCard` (served at `/.well-known/agent-card.json`) and
 * `respondToA2aPost` (the JSON-RPC binding at `/api/a2a`). Client leg:
 * `delegateArchitectureReview`, whose result is always a claim, never evidence. Assistant
 * leg: `createA2aDelegationAdapter`, the external-operations adapter behind
 * `delegate_architecture_review` (operator-listed peers, approval-bound, budgeted).
 */
export * from './agent-card.ts';
export * from './config.ts';
export * from './delegate.ts';
export * from './delegation-budget.ts';
export * from './delegation-directory.ts';
export * from './delegation-peer.ts';
export * from './external-adapter.ts';
export * from './guarded-fetch.ts';
export * from './http.adapter.ts';
export * from './message-parts.ts';
export * from './peer-card.ts';
export * from './peer-policy.ts';
export * from './remote-findings.ts';
export * from './review-executor.ts';
export * from './review-report.ts';
export * from './review-request.ts';
export * from './review-sample.ts';
export * from './transport.ts';
