/**
 * Vocabulary shared by the External Service Lab's service client and its UI.
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
 * - `misconfigured` — set, but refused by a `ServiceTargetProblem`. Nothing is sent.
 * - `configured` — a call may be attempted; whether it succeeds is a separate question.
 */
export type ServiceTargetSetup = 'configured' | 'unconfigured' | 'misconfigured';

/** Why a set target was refused. Names the rule, never the value. */
export type ServiceTargetProblem =
	/** Only one of URL and credential is set. */
	| 'incomplete'
	/** Not a parseable http(s) URL. */
	| 'invalid_url'
	/** The URL carries a path, query, fragment or userinfo — it must be an origin only. */
	| 'not_an_origin'
	/** Plain http where the credential could cross a public network. */
	| 'insecure_url'
	/** Fewer than 32 characters. */
	| 'short_token'
	/** Not printable ASCII without spaces — it could not travel unchanged in a header. */
	| 'malformed_token';

/** The service's operations, as the service client names them. */
export type ServiceOperationName = 'live' | 'status' | 'evaluate';

/**
 * How a call ended when it did not succeed. One kind per cause a caller would act on
 * differently — retry later, fix the deploy, fix the request, report a bug.
 */
export type ServiceFailureKind =
	/** No response: connection refused, reset before a response, DNS failure. */
	| 'unreachable'
	/** No complete answer within the deadline (ours, or the service's own 408). */
	| 'timed_out'
	/** The service refused the credential. Proof the service enforces auth itself. */
	| 'unauthorized'
	/** The service judged the request malformed or out of bounds (400), or the client rejected it before sending. */
	| 'invalid_request'
	/** The request body exceeded the service's limit (413). */
	| 'too_large'
	/** Any other non-2xx answer — an unexpected failure on the service side. */
	| 'service_error'
	/** A 2xx answer that is not the contract's shape: cut off, oversized, not JSON, or the wrong fields. */
	| 'malformed_response';

/** Every way a lab call can end, including the setups where nothing was sent. */
export type ServiceCallOutcome = 'ok' | ServiceFailureKind | Exclude<ServiceTargetSetup, 'configured'>;

/**
 * Where the time went. `null` means "not observed", never zero:
 * - `roundTripMs` — fetch start to fully read body (the last attempt). Network + host proxy + service.
 * - `serviceMs` — the service's own `Server-Timing: app` figure.
 * - `clientMs` — everything else the service client spent: validation, parsing, retry backoff.
 */
export interface ServiceCallTiming {
	totalMs: number;
	roundTripMs: number | null;
	serviceMs: number | null;
	clientMs: number | null;
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

/** A target check: liveness (public), then status (authenticated) once liveness answered. */
/**
 * A running service's contract relative to the one this app was built against
 * (`contract-skew.ts`). A diagnosis shown beside the release — calls are never refused on it.
 */
export const CONTRACT_SKEWS = ['none', 'service_ahead', 'service_behind', 'breaking', 'unknown'] as const;
export type ContractSkew = (typeof CONTRACT_SKEWS)[number];

export interface PublicTargetCheck {
	live: PublicServiceCall<ServiceLiveness>;
	status: PublicServiceCall<ServiceStatus> | null;
	/** Present when status answered: its `release` against this app's `CONTRACT_RELEASE`. */
	contractSkew: ContractSkew | null;
}

/**
 * How long a target check may wait. `wake` exists for hosts that sleep when idle: a cold
 * start (~1 min on Render Free) never fits the ordinary ceiling, so without it the lab could
 * report a timeout but never observe the cold start itself.
 */
export const CHECK_PATIENCE = ['normal', 'wake'] as const;
export type CheckPatience = (typeof CHECK_PATIENCE)[number];

/** Preset evaluation requests. The page sends an id, never a request body. */
export const EVALUATION_PRESET_IDS = ['fulfilled', 'partial_refund', 'ship_unpaid', 'overpaid'] as const;
export type EvaluationPresetId = (typeof EVALUATION_PRESET_IDS)[number];

/**
 * Deliberate failure demonstrations. Each is a real call with one thing changed on OUR side;
 * the service has no fault-injection switch to flip.
 * - `deadline` — the request's budget is already spent: the client refuses to start (real
 *   deadline path, no request sent).
 * - `credential` — a fixed wrong bearer: the service's real 401.
 * - `unvalidated` — out-of-bounds input sent past the client's validation: the service's real 400.
 */
export const SERVICE_DRILL_IDS = ['deadline', 'credential', 'unvalidated'] as const;
export type ServiceDrillId = (typeof SERVICE_DRILL_IDS)[number];

/** Why the lab turned a submission away before calling anything. */
export type LabRejection = 'rate_limited' | 'rejected' | 'invalid';
