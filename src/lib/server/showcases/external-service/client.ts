/**
 * The typed adapter to the external service — the one function every caller goes through.
 *
 * Framework-free: it takes a resolved target, an operation, an input and a deadline, and
 * returns a value. It never throws for anything the network or the service can do, so a
 * service that is down, slow, misconfigured or lying cannot become an exception in a page
 * that merely calls it. What it guarantees:
 *
 * - **Bounded** — every attempt runs inside the caller's `Deadline` (`http/deadline.ts`),
 *   and the response body is read with a byte budget (`http/body.ts`).
 * - **Validated both ways** — the request against the contract mirror before it is sent,
 *   the response before it is returned (`contract.ts`).
 * - **Classified** — exactly one `ServiceFailureKind` per failure, from the status code or
 *   the transport error, never from message text.
 * - **Retried only when safe** — once, only for operations declared idempotent, and only
 *   when nothing answered (`unreachable`): a request that reached the service and timed
 *   out may have been processed, and a retry is not free on a waking host.
 * - **Correlated and timed** — `x-request-id` is sent (the service echoes and logs it),
 *   the round trip is measured, and the service's own `Server-Timing: app` is read so the
 *   caller can separate network cost from processing cost.
 * - **Quiet about secrets** — the credential is a header and nothing else: never logged,
 *   never in a result, never in a message. The origin is not logged either.
 */
import * as v from 'valibot';
import { readTextBounded } from '$lib/server/http/body';
import type { Deadline } from '$lib/server/http/deadline';
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
		idempotent: true,
		requestSchema: null,
		responseSchema: LiveResponseSchema,
	} satisfies ServiceOperation<undefined, ServiceLiveness>,
	status: {
		name: 'status',
		method: 'GET',
		path: '/v1/status',
		idempotent: true,
		requestSchema: null,
		responseSchema: StatusResponseSchema,
	} satisfies ServiceOperation<undefined, ServiceStatus>,
	evaluate: {
		name: 'evaluate',
		method: 'POST',
		path: '/v1/evaluate',
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
			/** `null` when nothing answered, or the adapter refused to send. */
			httpStatus: number | null;
			message: string;
			requestId: string;
			timing: ServiceCallTiming;
	  };

export interface ServiceCallOptions {
	deadline: Deadline;
	fetch?: typeof fetch;
	/** Correlation id to send; minted when absent. */
	requestId?: string;
	/** Drills only: send this credential instead of the target's. */
	token?: string;
	/** Drills only: `false` sends the input without validating it first. */
	validateRequest?: boolean;
}

/** Nothing answered: refused, reset, DNS. The one failure a retry can fix. */
class ServiceUnreachableError extends Error {
	constructor() {
		super('no answer from the service');
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

function statusKind(status: number): ServiceFailureKind {
	if (status === 401) return 'unauthorized';
	if (status === 400) return 'invalid_request';
	if (status === 413) return 'too_large';
	if (status === 408) return 'timed_out';
	return 'service_error';
}

/** `app;dur=1.234` → 1.234. Reads only the service's own `app` metric. */
export function parseServiceTiming(header: string | null): number | null {
	if (!header) return null;
	for (const metric of header.split(',')) {
		const [name, ...params] = metric.split(';').map((part) => part.trim());
		if (name !== 'app') continue;
		for (const param of params) {
			const [key, value] = param.split('=');
			if (key === 'dur') {
				const ms = Number(value);
				return Number.isFinite(ms) && ms >= 0 ? ms : null;
			}
		}
	}
	return null;
}

const round = (ms: number) => Math.round(ms * 100) / 100;

export async function callService<Input, Output>(
	target: ServiceTarget,
	operation: ServiceOperation<Input, Output>,
	input: Input,
	options: ServiceCallOptions,
): Promise<ServiceCall<Output>> {
	const started = performance.now();
	const requestId = options.requestId ?? crypto.randomUUID();
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
			adapterMs: roundTripMs === null ? null : round(Math.max(0, totalMs - roundTripMs)),
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
		if (options.validateRequest !== false && operation.requestSchema) {
			const parsed = v.safeParse(operation.requestSchema, input);
			if (!parsed.success) {
				const where = v.getDotPath(parsed.issues[0]) ?? 'request';
				return fail('invalid_request', null, `Refused before sending: ${where} — ${parsed.issues[0].message}`);
			}
		}
		body = JSON.stringify(input);
	}

	const headers: Record<string, string> = {
		accept: 'application/json',
		authorization: `Bearer ${options.token ?? target.token}`,
		'x-request-id': requestId,
	};
	if (body !== undefined) headers['content-type'] = 'application/json';

	let answered: { response: Response; text: string | null };
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
					// An abort is the deadline speaking; anything else is "nobody answered".
					if (signal.aborted) throw error;
					throw new ServiceUnreachableError();
				}
				let read: Awaited<ReturnType<typeof readTextBounded>>;
				try {
					read = await readTextBounded(response, MAX_RESPONSE_BYTES);
				} catch (error) {
					// The connection died mid-body: as unanswered as a refused connect.
					if (signal.aborted) throw error;
					throw new ServiceUnreachableError();
				}
				roundTripMs = performance.now() - attemptStarted;
				serviceMs = parseServiceTiming(response.headers.get('server-timing'));
				return { response, text: read.ok ? read.value : null };
			},
			{ retryable: (error) => error instanceof ServiceUnreachableError },
		);
	} catch (error) {
		return fail(error instanceof ServiceUnreachableError ? 'unreachable' : 'timed_out', null);
	}

	const { response, text } = answered;
	if (text === null) {
		return fail('malformed_response', response.status, `The answer exceeded ${MAX_RESPONSE_BYTES} bytes.`);
	}

	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}

	if (!response.ok) {
		const kind = statusKind(response.status);
		const envelope = v.safeParse(ErrorEnvelopeSchema, json);
		// The service's validation message names the offending field — worth passing on.
		// Every other kind keeps its fixed message: an error body is not trusted prose.
		const message =
			kind === 'invalid_request' && envelope.success
				? envelope.output.error.message.slice(0, MAX_SERVICE_MESSAGE_LENGTH)
				: undefined;
		return fail(kind, response.status, message);
	}

	if (json === undefined) return fail('malformed_response', response.status, 'The answer was not JSON.');
	const parsed = v.safeParse(operation.responseSchema, json);
	if (!parsed.success) {
		const where = v.getDotPath(parsed.issues[0]) ?? 'body';
		return fail('malformed_response', response.status, `The answer did not match the contract at ${where}.`);
	}

	return { ok: true, data: parsed.output, httpStatus: response.status, requestId, timing: timing() };
}
