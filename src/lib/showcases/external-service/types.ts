/**
 * Vocabulary shared by the External Service Lab's server adapter and its UI.
 *
 * Client-importable on purpose: everything here is safe for the browser — ids, outcome
 * kinds and the public projection of a call. Credentials and base URLs never appear in
 * these types, so they cannot reach the page by accident through a field that exists.
 */
import type { components } from './contract.generated';

type Schemas = components['schemas'];
export type ServiceStatus = Schemas['StatusResponse'];
export type ServiceLiveness = Schemas['LiveResponse'];
export type OrderEvaluation = Schemas['EvaluateResponse'];
export type OrderEvaluationRequest = Schemas['EvaluateRequest'];

/** A named, server-configured place the external service is reached. Never a URL. */
export const SERVICE_TARGET_IDS = ['local', 'remote'] as const;
export type ServiceTargetId = (typeof SERVICE_TARGET_IDS)[number];

/**
 * What the server knows about a target before calling it.
 * - `unconfigured` — no URL or credential set: the target is simply not part of this deploy.
 * - `misconfigured` — set, but refused (plain http to the remote target, a path in the URL,
 *   a short credential). Nothing is sent.
 * - `configured` — a call may be attempted; whether it succeeds is a separate question.
 */
export type ServiceTargetSetup = 'configured' | 'unconfigured' | 'misconfigured';

/** The service's operations, as the adapter names them. */
export type ServiceOperationName = 'live' | 'status' | 'evaluate';

/**
 * How a call ended when it did not succeed. One kind per cause a caller would act on
 * differently — retry later, fix the deploy, fix the request, report a bug.
 */
export type ServiceFailureKind =
	/** Connection refused, reset or DNS failure — nothing answered. */
	| 'unreachable'
	/** No complete answer within the deadline (ours, or the service's own 408). */
	| 'timed_out'
	/** The service refused the credential. Proof the service enforces auth itself. */
	| 'unauthorized'
	/** The service judged the request malformed or out of bounds (400). */
	| 'invalid_request'
	/** The request body exceeded the service's limit (413). */
	| 'too_large'
	/** Any other non-2xx answer — an unexpected failure on the service side. */
	| 'service_error'
	/** A 2xx answer that is not the contract's shape: oversized, not JSON, or the wrong fields. */
	| 'malformed_response';

/** Every way a lab call can end, including the two where nothing was sent. */
export type ServiceCallOutcome = 'ok' | ServiceFailureKind | 'unconfigured' | 'misconfigured';

/**
 * Where the time went. `null` means "not observed", never zero:
 * - `roundTripMs` — fetch start to fully read body (the last attempt). Network + host proxy + service.
 * - `serviceMs` — the service's own `Server-Timing: app` figure.
 * - `adapterMs` — everything else the adapter spent: validation, parsing, retry backoff.
 */
export interface ServiceCallTiming {
	totalMs: number;
	roundTripMs: number | null;
	serviceMs: number | null;
	adapterMs: number | null;
	attempts: number;
}

/** One call as the page may see it. */
export interface PublicServiceCall<T = unknown> {
	target: ServiceTargetId;
	operation: ServiceOperationName;
	outcome: ServiceCallOutcome;
	/** The service's HTTP status, when it answered at all. */
	httpStatus: number | null;
	/** A fixed explanation, or the service's own validation message for `invalid_request`. */
	message: string | null;
	/** The `x-request-id` sent — the same id appears in the service's log line. */
	requestId: string | null;
	timing: ServiceCallTiming | null;
	data: T | null;
	measuredAt: string;
}

/** Preset evaluation requests. The page sends an id, never a request body. */
export const EVALUATION_SCENARIO_IDS = ['fulfilled', 'partial_refund', 'ship_unpaid', 'overpaid'] as const;
export type EvaluationScenarioId = (typeof EVALUATION_SCENARIO_IDS)[number];

/**
 * Deliberate failure demonstrations. Each is a real call with one thing changed on OUR side;
 * the service has no fault-injection switch to flip.
 * - `deadline` — the request's budget is already spent: the adapter refuses to start (real
 *   deadline path, no request sent).
 * - `credential` — a fixed wrong bearer: the service's real 401.
 * - `unvalidated` — out-of-bounds input sent past the adapter's validation: the service's real 400.
 */
export const SERVICE_DRILL_IDS = ['deadline', 'credential', 'unvalidated'] as const;
export type ServiceDrillId = (typeof SERVICE_DRILL_IDS)[number];
