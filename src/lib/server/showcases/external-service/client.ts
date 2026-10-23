/**
 * The service client — the one function every caller of the external service goes through.
 *
 * Framework-free: it takes a resolved target, an operation, an input and a deadline, and
 * returns a value. It never throws for anything the network or the service can do, so a
 * service that is down, slow, misconfigured or lying cannot become an exception in a page
 * that merely calls it. What it guarantees:
 *
 * - **Bounded** — every attempt runs inside the caller's `Deadline` (`http/deadline.ts`),
 *   and the response body is read with a byte budget (`http/body.ts`).
 * - **Validated both ways** — the request against the contract mirror before it is sent
 *   (when the operation has a request schema), the response before it is returned
 *   (`contract.ts`).
 * - **Classified** — exactly one `ServiceFailureKind` per failure, from the status code or
 *   the transport error, never from message text.
 * - **Retried only when safe** — once, only for operations declared idempotent, and only
 *   when no response arrived (`unreachable`). Once a response head has arrived nothing is
 *   retried: the service has the request. A timeout is never retried either — the request
 *   may have been processed, and on a waking host a retry only waits for the same cold start.
 * - **Least privilege** — the credential is sent only on operations that need it.
 * - **Correlated and timed** — `x-request-id` is sent (the service echoes and logs it),
 *   the round trip is measured, and the service's own `Server-Timing: app` is read so the
 *   caller can separate network cost from processing cost.
 * - **Quiet about secrets** — the credential is a header and nothing else: never logged,
 *   never in a result, never in a message. The origin is not logged either.
 *
 * Deliberately absent: options to override the credential or skip validation. A drill that
 * needs either builds a different target or operation (`lab.ts`) — the reference client
 * stays the thing to copy.
 */
import * as v from 'valibot';
import { readTextBounded } from '$lib/server/http/body';
import type { Deadline } from '$lib/server/http/deadline';
import { readServerTimingMetric } from '$lib/server/http/request-timing';
import { retryWithin } from '$lib/server/resilience';
import type {
	OrderEvaluation,
	OrderEvaluationRequest,
	ServiceCallTiming,
	ServiceFailureKind,
	ServiceLiveness,
	ServiceOperationName,
	ServiceStatus,
} from '$lib/showcases/external-service/types';
import {
	MAX_RESPONSE_BYTES,
	MAX_SERVICE_MESSAGE_LENGTH,
	RETRY_ATTEMPTS,
	RETRY_BASE_DELAY_MS,
	RETRY_MAX_DELAY_MS,
} from './config';
import {
	ErrorEnvelopeSchema,
	EvaluateRequestSchema,
	EvaluateResponseSchema,
	LiveResponseSchema,
	StatusResponseSchema,
} from './contract';
import type { ServiceTarget } from './targets';

export interface ServiceOperation<Input, Output> {
	name: ServiceOperationName;
	method: 'GET' | 'POST';
	path: string;
	/** Sends the target's bearer credential. Public operations do not get it. */
	authenticated: boolean;
	/** Safe to repeat: the same request has the same effect however often it arrives. */
	idempotent: boolean;
	requestSchema: v.GenericSchema<Input> | null;
	responseSchema: v.GenericSchema<Output>;
}

/** The service's operations. Paths are fixed here; a caller cannot supply one. */
export const SERVICE_OPERATIONS = {
	live: {
		name: 'live',
		method: 'GET',
		path: '/health/live',
		authenticated: false,
		idempotent: true,
		requestSchema: null,
		responseSchema: LiveResponseSchema,
	} satisfies ServiceOperation<undefined, ServiceLiveness>,
	status: {
		name: 'status',
		method: 'GET',
		path: '/v1/status',
		authenticated: true,
		idempotent: true,
		requestSchema: null,
		responseSchema: StatusResponseSchema,
	} satisfies ServiceOperation<undefined, ServiceStatus>,
	evaluate: {
		name: 'evaluate',
		method: 'POST',
		path: '/v1/evaluate',
		authenticated: true,
		// A pure function of its input — the contract says so (`openapi.json`), so it is
		// declared idempotent even though it is a POST.
		idempotent: true,
		requestSchema: EvaluateRequestSchema,
		responseSchema: EvaluateResponseSchema,
	} satisfies ServiceOperation<OrderEvaluationRequest, OrderEvaluation>,
};

export type ServiceCall<T> =
	| { ok: true; data: T; httpStatus: number; requestId: string; timing: ServiceCallTiming }
	| {
			ok: false;
			kind: ServiceFailureKind;
			/** `null` when nothing answered, or the client refused to send. */
			httpStatus: number | null;
			message: string;
			requestId: string;
			timing: ServiceCallTiming;
	  };

export interface ServiceCallOptions {
	deadline: Deadline;
	fetch?: typeof fetch;
	/**
	 * Correlation id to send. Used only when it satisfies the service's own rule (1–64 of
	 * `[A-Za-z0-9._-]`) — otherwise the service would replace it and the id in our result
	 * would match no service log line; a fresh UUID is minted instead.
	 */
	requestId?: string;
}

/** No response arrived: refused, reset before a response, DNS. The one failure a retry can fix. */
class ServiceUnreachableError extends Error {
	constructor() {
		super('no response from the service');
		this.name = 'ServiceUnreachableError';
	}
}

const FAILURE_MESSAGES: Record<ServiceFailureKind, string> = {
	unreachable: 'Nothing answered at the configured address.',
	timed_out: 'No complete answer within the deadline.',
	unauthorized: 'The service refused the credential.',
	invalid_request: 'The service refused the request as invalid.',
	too_large: 'The request body exceeded the service limit.',
	service_error: 'The service answered with an unexpected error status.',
	malformed_response: 'The answer did not match the contract.',
};

/** The error statuses this client tells apart; every other non-2xx is `service_error`. */
export const CLASSIFIED_ERROR_STATUSES = {
	400: 'invalid_request',
	401: 'unauthorized',
	408: 'timed_out',
	413: 'too_large',
} as const;

function statusKind(status: number): ServiceFailureKind {
	return (CLASSIFIED_ERROR_STATUSES as Record<number, ServiceFailureKind>)[status] ?? 'service_error';
}

const REQUEST_ID_RULE = /^[A-Za-z0-9._-]{1,64}$/;

const round = (ms: number) => Math.round(ms * 100) / 100;

export async function callService<Input, Output>(
	target: ServiceTarget,
	operation: ServiceOperation<Input, Output>,
	input: Input,
	options: ServiceCallOptions,
): Promise<ServiceCall<Output>> {
	const started = performance.now();
	const requestId =
		options.requestId && REQUEST_ID_RULE.test(options.requestId) ? options.requestId : crypto.randomUUID();
	const fetchImpl = options.fetch ?? fetch;
	let attempts = 0;
	let roundTripMs: number | null = null;
	let serviceMs: number | null = null;

	const timing = (): ServiceCallTiming => {
		const totalMs = performance.now() - started;
		return {
			totalMs: round(totalMs),
			roundTripMs: roundTripMs === null ? null : round(roundTripMs),
			serviceMs: serviceMs === null ? null : round(serviceMs),
			clientMs: roundTripMs === null ? null : round(Math.max(0, totalMs - roundTripMs)),
			attempts,
		};
	};

	const fail = (kind: ServiceFailureKind, httpStatus: number | null, message?: string): ServiceCall<Output> => {
		const result = {
			ok: false as const,
			kind,
			httpStatus,
			message: message ?? FAILURE_MESSAGES[kind],
			requestId,
			timing: timing(),
		};
		// Operational facts only: no origin, no credential, no body.
		console.warn(
			`[external-service] ${operation.name} → ${kind}`,
			JSON.stringify({ target: target.id, httpStatus, requestId, ms: result.timing.totalMs, attempts }),
		);
		return result;
	};

	let body: string | undefined;
	if (operation.method === 'POST') {
		if (operation.requestSchema) {
			const parsed = v.safeParse(operation.requestSchema, input);
			if (!parsed.success) {
				const where = v.getDotPath(parsed.issues[0]) ?? 'request';
				return fail('invalid_request', null, `Rejected before sending: ${where} — ${parsed.issues[0].message}`);
			}
		}
		body = JSON.stringify(input);
	}

	const headers: Record<string, string> = { accept: 'application/json', 'x-request-id': requestId };
	if (operation.authenticated) headers.authorization = `Bearer ${target.token}`;
	if (body !== undefined) headers['content-type'] = 'application/json';

	let answered: { response: Response; text: string | null; cut: boolean };
	try {
		answered = await retryWithin(
			options.deadline,
			{
				attempts: operation.idempotent ? RETRY_ATTEMPTS : 1,
				baseDelayMs: RETRY_BASE_DELAY_MS,
				maxDelayMs: RETRY_MAX_DELAY_MS,
			},
			async (signal) => {
				attempts++;
				const attemptStarted = performance.now();
				let response: Response;
				try {
					response = await fetchImpl(new URL(operation.path, target.origin), {
						method: operation.method,
						headers,
						body,
						signal,
						// A fixed origin stays fixed: a redirect is an answer to classify, not a
						// destination to follow with the credential attached.
						redirect: 'manual',
					});
				} catch (error) {
					// An abort is the deadline speaking; anything else is "no response".
					if (signal.aborted) throw error;
					throw new ServiceUnreachableError();
				}
				// From here the service has the request: nothing below is retryable.
				let read: Awaited<ReturnType<typeof readTextBounded>> | null;
				try {
					read = await readTextBounded(response, MAX_RESPONSE_BYTES);
				} catch (error) {
					if (signal.aborted) throw error;
					read = null; // the connection died mid-body
				}
				roundTripMs = performance.now() - attemptStarted;
				serviceMs = readServerTimingMetric(response.headers.get('server-timing'), 'app');
				return { response, text: read?.ok ? read.value : null, cut: read === null };
			},
			{ retryable: (error) => error instanceof ServiceUnreachableError },
		);
	} catch (error) {
		return fail(error instanceof ServiceUnreachableError ? 'unreachable' : 'timed_out', null);
	}

	const { response, text, cut } = answered;

	if (!response.ok) {
		// The status decides, whatever the body did: an oversized or cut-off error page is
		// still that error.
		const kind = statusKind(response.status);
		let message: string | undefined;
		// The service's validation message names the offending field — worth passing on.
		// Every other kind keeps its fixed message: an error body is not trusted prose.
		if (kind === 'invalid_request' && text !== null) {
			const envelope = v.safeParse(ErrorEnvelopeSchema, parseJson(text));
			if (envelope.success) message = envelope.output.error.message.slice(0, MAX_SERVICE_MESSAGE_LENGTH);
		}
		return fail(kind, response.status, message);
	}

	if (cut) return fail('malformed_response', response.status, 'The answer was cut off.');
	if (text === null) {
		return fail('malformed_response', response.status, `The answer exceeded ${MAX_RESPONSE_BYTES} bytes.`);
	}
	const json = parseJson(text);
	if (json === undefined) return fail('malformed_response', response.status, 'The answer was not JSON.');
	const parsed = v.safeParse(operation.responseSchema, json);
	if (!parsed.success) {
		const where = v.getDotPath(parsed.issues[0]) ?? 'body';
		return fail('malformed_response', response.status, `The answer did not match the contract at ${where}.`);
	}

	return { ok: true, data: parsed.output, httpStatus: response.status, requestId, timing: timing() };
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}
