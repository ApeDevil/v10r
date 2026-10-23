/**
 * GENERATED — do not edit. Source: services/runtime-lab/openapi.json
 * Regenerate: bun run external-service:contract
 */

export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness: the process is up and serving. Public, and therefore says nothing else. */
        get: operations["live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/evaluate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Evaluate order events against the lifecycle rules. Pure and deterministic, so
         *     repeating a request is safe.
         */
        post: operations["evaluate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Service identity, release and limits. */
        get: operations["status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ErrorBody: {
            code: components["schemas"]["ErrorCode"];
            message: string;
        };
        /**
         * @description Stable machine-readable error codes. Messages are for humans and may change.
         * @enum {string}
         */
        ErrorCode: "invalid_request" | "unauthorized" | "not_found" | "method_not_allowed" | "payload_too_large" | "timeout";
        /**
         * @description v10r's API error envelope (`src/lib/server/http/response.ts`), reused so the
         *     service does not introduce a second error convention.
         */
        ErrorEnvelope: {
            error: components["schemas"]["ErrorBody"];
        };
        /** @description An order total and the events to evaluate against it, in order. */
        EvaluateRequest: {
            events: components["schemas"]["EventInput"][];
            /**
             * Format: int64
             * @description Order total in cents.
             */
            totalCents: number;
        };
        /**
         * @description A completed evaluation. `refused` is an answer, not an error: the request was valid
         *     and a rule said no.
         */
        EvaluateResponse: {
            finalState: components["schemas"]["OrderState"];
            /** @enum {string} */
            outcome: "accepted";
            /** Format: int64 */
            paidCents: number;
            /** Format: int64 */
            refundedCents: number;
            steps: components["schemas"]["OrderTransition"][];
        } | {
            /** @enum {string} */
            outcome: "refused";
            /** Format: int64 */
            paidCents: number;
            /** Format: int64 */
            refundedCents: number;
            refusal: components["schemas"]["RuleRefusal"];
            steps: components["schemas"]["OrderTransition"][];
        };
        /** @description One order event. `pay` and `refund` carry an amount; the others carry nothing. */
        EventInput: {
            /** Format: int64 */
            amountCents: number;
            /** @enum {string} */
            type: "pay";
        } | {
            /** @enum {string} */
            type: "ship";
        } | {
            /** @enum {string} */
            type: "deliver";
        } | {
            /** @enum {string} */
            type: "cancel";
        } | {
            /** Format: int64 */
            amountCents: number;
            /** @enum {string} */
            type: "refund";
        };
        /** @enum {string} */
        EventType: "pay" | "ship" | "deliver" | "cancel" | "refund";
        /** @description Liveness only. Deliberately carries nothing else: this route is public. */
        LiveResponse: {
            status: components["schemas"]["LiveStatus"];
        };
        /** @enum {string} */
        LiveStatus: "live";
        /** @enum {string} */
        Operation: "evaluate";
        /** @enum {string} */
        OrderState: "placed" | "partially_paid" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";
        /** @description One applied event. */
        OrderTransition: {
            event: components["schemas"]["EventType"];
            from: components["schemas"]["OrderState"];
            /** Format: int32 */
            index: number;
            to: components["schemas"]["OrderState"];
        };
        /** @enum {string} */
        RefusalReason: "not_allowed_in_state" | "payment_incomplete" | "exceeds_balance";
        /** @description The first event a rule refused; evaluation stops there. */
        RuleRefusal: {
            event: components["schemas"]["EventType"];
            /** Format: int32 */
            index: number;
            reason: components["schemas"]["RefusalReason"];
            /** @description The state the order was in when the event was refused. */
            state: components["schemas"]["OrderState"];
        };
        ServiceLimits: {
            /** Format: int64 */
            maxAmountCents: number;
            /** Format: int32 */
            maxBodyBytes: number;
            /** Format: int32 */
            maxEvents: number;
        };
        /** @description Service identity for authenticated callers. */
        StatusResponse: {
            limits: components["schemas"]["ServiceLimits"];
            operations: components["schemas"]["Operation"][];
            /** @description Semantic version of this build (Cargo package version). */
            release: string;
            /** @description Stable service name. */
            service: string;
            /**
             * Format: int64
             * @description Milliseconds since the process started. A value smaller than the caller's
             *     round trip means this request woke the service (a cold start).
             */
            uptimeMs: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    live: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The process is serving */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LiveResponse"];
                };
            };
        };
    };
    evaluate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EvaluateRequest"];
            };
        };
        responses: {
            /** @description Evaluation completed — accepted or refused */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluateResponse"];
                };
            };
            /** @description The request is malformed or out of bounds */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Missing or wrong bearer credential */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description The request did not complete in time */
            408: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description The request body is too large */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service identity */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatusResponse"];
                };
            };
            /** @description Missing or wrong bearer credential */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
}

/** The contract release this app is built against (`info.version`). */
export const CONTRACT_RELEASE = '0.1.1';
