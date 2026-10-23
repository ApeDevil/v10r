//! The wire contract: every shape that crosses the HTTP boundary, and the OpenAPI
//! document derived from them.
//!
//! This module is the single authority for the API. `openapi.json` is generated from it
//! (`cargo run -- openapi`, pinned by `tests` below) and v10r's TypeScript types are
//! generated from that file in turn, so a change here reaches the caller as a type error
//! rather than as a surprise at runtime.
//!
//! Wire types are separate from the domain types in `order.rs` on purpose: the domain can
//! be refactored without moving the contract, and a contract change is always a visible
//! edit to this file.

use serde::{Deserialize, Serialize};
use utoipa::openapi::RefOr;
use utoipa::openapi::schema::{AdditionalProperties, Schema};
use utoipa::openapi::security::{Http, HttpAuthScheme, SecurityScheme};
use utoipa::{OpenApi, ToSchema};

use crate::order;

// ── Requests ────────────────────────────────────────────────────────────────

/// An order total and the events to evaluate against it, in order.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvaluateRequest {
    /// Order total in cents.
    #[schema(minimum = 1, maximum = 100_000_000)]
    pub total_cents: u64,
    #[schema(min_items = 1, max_items = 64)]
    pub events: Vec<EventInput>,
}

/// One order event. `pay` and `refund` carry an amount; the others carry nothing.
#[derive(Debug, Deserialize, ToSchema)]
// Field renames are per variant, not `rename_all_fields`: utoipa ignores that attribute
// and would publish `amount_cents` while serde reads `amountCents`. The conformance test
// in `main.rs` holds the spec to what serde actually does.
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum EventInput {
    #[serde(rename_all = "camelCase")]
    Pay {
        #[schema(minimum = 1, maximum = 100_000_000)]
        amount_cents: u64,
    },
    // Empty struct variants, not unit variants: serde's `deny_unknown_fields` does not
    // reach unit variants of an internally tagged enum, so `{"type":"ship","amountCents":5}`
    // would be silently accepted. Caught by `http::tests::invalid_input_never_reaches_the_rules`.
    Ship {},
    Deliver {},
    Cancel {},
    #[serde(rename_all = "camelCase")]
    Refund {
        #[schema(minimum = 1, maximum = 100_000_000)]
        amount_cents: u64,
    },
}

impl From<&EventInput> for order::OrderEvent {
    fn from(input: &EventInput) -> Self {
        match *input {
            EventInput::Pay { amount_cents } => order::OrderEvent::Pay { amount_cents },
            EventInput::Ship {} => order::OrderEvent::Ship,
            EventInput::Deliver {} => order::OrderEvent::Deliver,
            EventInput::Cancel {} => order::OrderEvent::Cancel,
            EventInput::Refund { amount_cents } => order::OrderEvent::Refund { amount_cents },
        }
    }
}

// ── Responses ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum LiveStatus {
    Live,
}

/// Liveness only. Deliberately carries nothing else: this route is public.
#[derive(Debug, Serialize, ToSchema)]
pub struct LiveResponse {
    pub status: LiveStatus,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    Evaluate,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ServiceLimits {
    pub max_events: u32,
    pub max_amount_cents: u64,
    pub max_body_bytes: u32,
}

/// Service identity for authenticated callers.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    /// Stable service name.
    pub service: String,
    /// Semantic version of this build (Cargo package version).
    pub release: String,
    /// Milliseconds since the process started. A value smaller than the caller's
    /// round trip means this request woke the service (a cold start).
    pub uptime_ms: u64,
    pub operations: Vec<Operation>,
    pub limits: ServiceLimits,
}

#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum OrderState {
    Placed,
    PartiallyPaid,
    Paid,
    Shipped,
    Delivered,
    Cancelled,
    Refunded,
}

impl From<order::OrderState> for OrderState {
    fn from(state: order::OrderState) -> Self {
        match state {
            order::OrderState::Placed => OrderState::Placed,
            order::OrderState::PartiallyPaid => OrderState::PartiallyPaid,
            order::OrderState::Paid => OrderState::Paid,
            order::OrderState::Shipped => OrderState::Shipped,
            order::OrderState::Delivered => OrderState::Delivered,
            order::OrderState::Cancelled => OrderState::Cancelled,
            order::OrderState::Refunded => OrderState::Refunded,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Pay,
    Ship,
    Deliver,
    Cancel,
    Refund,
}

impl From<order::EventKind> for EventType {
    fn from(kind: order::EventKind) -> Self {
        match kind {
            order::EventKind::Pay => EventType::Pay,
            order::EventKind::Ship => EventType::Ship,
            order::EventKind::Deliver => EventType::Deliver,
            order::EventKind::Cancel => EventType::Cancel,
            order::EventKind::Refund => EventType::Refund,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RefusalReason {
    NotAllowedInState,
    PaymentIncomplete,
    ExceedsBalance,
}

impl From<order::RefusalReason> for RefusalReason {
    fn from(reason: order::RefusalReason) -> Self {
        match reason {
            order::RefusalReason::NotAllowedInState => RefusalReason::NotAllowedInState,
            order::RefusalReason::PaymentIncomplete => RefusalReason::PaymentIncomplete,
            order::RefusalReason::ExceedsBalance => RefusalReason::ExceedsBalance,
        }
    }
}

/// One applied event.
#[derive(Debug, Serialize, ToSchema)]
pub struct OrderTransition {
    pub index: u32,
    pub event: EventType,
    pub from: OrderState,
    pub to: OrderState,
}

/// The first event a rule refused; evaluation stops there.
#[derive(Debug, Serialize, ToSchema)]
pub struct RuleRefusal {
    pub index: u32,
    pub event: EventType,
    /// The state the order was in when the event was refused.
    pub state: OrderState,
    pub reason: RefusalReason,
}

/// A completed evaluation. `refused` is an answer, not an error: the request was valid
/// and a rule said no.
#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum EvaluateResponse {
    #[serde(rename_all = "camelCase")]
    Accepted {
        steps: Vec<OrderTransition>,
        final_state: OrderState,
        paid_cents: u64,
        refunded_cents: u64,
    },
    #[serde(rename_all = "camelCase")]
    Refused {
        steps: Vec<OrderTransition>,
        refusal: RuleRefusal,
        paid_cents: u64,
        refunded_cents: u64,
    },
}

fn wire_steps(steps: Vec<order::Transition>) -> Vec<OrderTransition> {
    steps
        .into_iter()
        .map(|step| OrderTransition {
            // Bounded by MAX_EVENTS (64), so the narrowing cannot truncate.
            index: step.index as u32,
            event: step.event.into(),
            from: step.from.into(),
            to: step.to.into(),
        })
        .collect()
}

impl From<order::Evaluation> for EvaluateResponse {
    fn from(evaluation: order::Evaluation) -> Self {
        match evaluation {
            order::Evaluation::Accepted {
                steps,
                final_state,
                ledger,
            } => EvaluateResponse::Accepted {
                steps: wire_steps(steps),
                final_state: final_state.into(),
                paid_cents: ledger.paid_cents,
                refunded_cents: ledger.refunded_cents,
            },
            order::Evaluation::Refused {
                steps,
                refusal,
                ledger,
            } => EvaluateResponse::Refused {
                steps: wire_steps(steps),
                refusal: RuleRefusal {
                    index: refusal.index as u32,
                    event: refusal.event.into(),
                    state: refusal.state.into(),
                    reason: refusal.reason.into(),
                },
                paid_cents: ledger.paid_cents,
                refunded_cents: ledger.refunded_cents,
            },
        }
    }
}

// ── Errors ──────────────────────────────────────────────────────────────────

/// Stable machine-readable error codes. Messages are for humans and may change.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidRequest,
    Unauthorized,
    NotFound,
    MethodNotAllowed,
    PayloadTooLarge,
    Timeout,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub code: ErrorCode,
    pub message: String,
}

/// v10r's API error envelope (`src/lib/server/http/response.ts`), reused so the
/// service does not introduce a second error convention.
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorEnvelope {
    pub error: ErrorBody,
}

// ── OpenAPI document ────────────────────────────────────────────────────────

pub const BEARER_SCHEME: &str = "bearer";

/// Two corrections utoipa cannot derive, applied to the finished document (after the
/// router has contributed its paths and schemas — a `Modify` on `ApiDoc` runs too early
/// to see `EventInput`):
/// - the bearer security scheme the protected paths reference;
/// - closing each `EventInput` variant. serde's `deny_unknown_fields` on the enum rejects
///   `{"type":"ship","amountCents":5}`, but utoipa only closes plain structs, so without
///   this the published schema would admit requests the service refuses.
pub fn complete(openapi: &mut utoipa::openapi::OpenApi) {
    let components = openapi.components.get_or_insert_with(Default::default);
    components.add_security_scheme(
        BEARER_SCHEME,
        SecurityScheme::Http(Http::new(HttpAuthScheme::Bearer)),
    );
    if let Some(RefOr::T(Schema::OneOf(variants))) = components.schemas.get_mut("EventInput") {
        for variant in &mut variants.items {
            if let RefOr::T(Schema::Object(object)) = variant {
                object.additional_properties =
                    Some(Box::new(AdditionalProperties::FreeForm(false)));
            }
        }
    }
}

/// Document-level metadata. Paths are collected from the router itself
/// (`utoipa_axum::routes!`), so a route and its spec entry cannot be registered apart.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "runtime-lab",
        description = "v10r reference external service: deterministic order-lifecycle rules behind a bearer-authenticated HTTP API.",
        license(name = "MIT", identifier = "MIT")
    ),
    components(schemas(ErrorEnvelope))
)]
pub struct ApiDoc;
