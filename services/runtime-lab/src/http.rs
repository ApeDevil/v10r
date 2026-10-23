//! The HTTP transport: routes, authentication, bounds, correlation and the one log line.
//!
//! Everything a caller can observe about the boundary is decided here and nowhere else —
//! the domain (`order.rs`) never sees a request, a header or a status code.
//!
//! Layer order, outermost first (axum applies the last `.layer` outermost):
//! `observe` (request id, Server-Timing, log) → `time_limit` → body limit → routes, where
//! the protected routes add `require_bearer` before their handler. Authentication runs
//! before the body is parsed, so an unauthenticated caller never learns how a payload
//! would have been judged.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use axum::extract::rejection::JsonRejection;
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::{Json, Router};
use subtle::ConstantTimeEq;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::config::Secret;
use crate::contract::{
    self, ApiDoc, ErrorBody, ErrorCode, ErrorEnvelope, EvaluateRequest, EvaluateResponse,
    LiveResponse, LiveStatus, Operation, ServiceLimits, StatusResponse,
};
use crate::order;

/// Largest request body accepted. An evaluation of 64 events is well under 4 KiB.
pub const MAX_BODY_BYTES: usize = 8 * 1024;
/// Server-side ceiling per request, from parsed head to response. Far above any honest
/// evaluation; it bounds a client trickling its body and keeps a graceful drain short.
/// A client trickling its *head* is bounded by `main.rs` `HEADER_READ_TIMEOUT`.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
pub const REQUEST_ID_HEADER: &str = "x-request-id";
const SERVICE_NAME: &str = "runtime-lab";
const MAX_REQUEST_ID_LEN: usize = 64;

pub struct AppState {
    pub token: Secret,
    pub started: Instant,
}

pub type SharedState = Arc<AppState>;

fn public_routes() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new().routes(routes!(live))
}

fn protected_routes() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new()
        .routes(routes!(status))
        .routes(routes!(evaluate))
}

/// The OpenAPI document, collected from the same route functions the router serves.
pub fn openapi() -> utoipa::openapi::OpenApi {
    let (_, mut document) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .merge(public_routes())
        .merge(protected_routes())
        .split_for_parts();
    contract::complete(&mut document);
    document
}

pub fn router(state: SharedState) -> Router {
    let protected = protected_routes().route_layer(middleware::from_fn_with_state(
        state.clone(),
        require_bearer,
    ));
    let (router, _) = OpenApiRouter::new()
        .merge(public_routes())
        .merge(protected)
        .split_for_parts();
    router
        .fallback(not_found)
        .method_not_allowed_fallback(method_not_allowed)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn(time_limit))
        .layer(middleware::from_fn(observe))
        .with_state(state)
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// Liveness: the process is up and serving. Public, and therefore says nothing else.
#[utoipa::path(
    get,
    path = "/health/live",
    tag = "health",
    responses((status = 200, description = "The process is serving", body = LiveResponse))
)]
async fn live() -> Json<LiveResponse> {
    Json(LiveResponse {
        status: LiveStatus::Live,
    })
}

/// Service identity, release and limits.
#[utoipa::path(
    get,
    path = "/v1/status",
    tag = "service",
    security(("bearer" = [])),
    responses(
        (status = 200, description = "Service identity", body = StatusResponse),
        (status = 401, description = "Missing or wrong bearer credential", body = ErrorEnvelope)
    )
)]
async fn status(State(state): State<SharedState>) -> Json<StatusResponse> {
    Json(StatusResponse {
        service: SERVICE_NAME.into(),
        release: env!("CARGO_PKG_VERSION").into(),
        uptime_ms: u64::try_from(state.started.elapsed().as_millis()).unwrap_or(u64::MAX),
        operations: vec![Operation::Evaluate],
        limits: ServiceLimits {
            max_events: order::MAX_EVENTS as u32,
            max_amount_cents: order::MAX_AMOUNT_CENTS,
            max_body_bytes: MAX_BODY_BYTES as u32,
        },
    })
}

/// Evaluate order events against the lifecycle rules. Pure and deterministic, so
/// repeating a request is safe.
#[utoipa::path(
    post,
    path = "/v1/evaluate",
    tag = "orders",
    security(("bearer" = [])),
    request_body = EvaluateRequest,
    responses(
        (status = 200, description = "Evaluation completed — accepted or refused", body = EvaluateResponse),
        (status = 400, description = "The request is malformed or out of bounds", body = ErrorEnvelope),
        (status = 401, description = "Missing or wrong bearer credential", body = ErrorEnvelope),
        (status = 408, description = "The request did not complete in time", body = ErrorEnvelope),
        (status = 413, description = "The request body is too large", body = ErrorEnvelope)
    )
)]
async fn evaluate(payload: Result<Json<EvaluateRequest>, JsonRejection>) -> Response {
    let Json(request) = match payload {
        Ok(json) => json,
        Err(rejection) if rejection.status() == StatusCode::PAYLOAD_TOO_LARGE => {
            return error(
                StatusCode::PAYLOAD_TOO_LARGE,
                ErrorCode::PayloadTooLarge,
                format!("request body exceeds {MAX_BODY_BYTES} bytes"),
            );
        }
        Err(rejection) => {
            // serde's message names the offending field and why; bounded so a hostile
            // payload cannot make the error body large.
            return error(
                StatusCode::BAD_REQUEST,
                ErrorCode::InvalidRequest,
                clip(&rejection.body_text(), 240),
            );
        }
    };

    let events: Vec<order::OrderEvent> = request.events.iter().map(Into::into).collect();
    match order::evaluate(request.total_cents, &events) {
        Ok(evaluation) => Json(EvaluateResponse::from(evaluation)).into_response(),
        Err(invalid) => error(
            StatusCode::BAD_REQUEST,
            ErrorCode::InvalidRequest,
            format!("{}: {}", invalid.field, invalid.message),
        ),
    }
}

async fn not_found() -> Response {
    error(
        StatusCode::NOT_FOUND,
        ErrorCode::NotFound,
        "no such route".into(),
    )
}

async fn method_not_allowed() -> Response {
    error(
        StatusCode::METHOD_NOT_ALLOWED,
        ErrorCode::MethodNotAllowed,
        "method not allowed on this route".into(),
    )
}

fn error(status: StatusCode, code: ErrorCode, message: String) -> Response {
    (
        status,
        Json(ErrorEnvelope {
            error: ErrorBody { code, message },
        }),
    )
        .into_response()
}

// ── Middleware ──────────────────────────────────────────────────────────────

/// Bearer authentication, enforced here — the caller's own checks are not trusted.
/// The comparison is constant-time; only the length can leak, and the credential's
/// length is not the secret.
async fn require_bearer(
    State(state): State<SharedState>,
    request: Request,
    next: Next,
) -> Response {
    let presented = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split_once(' '))
        .filter(|(scheme, _)| scheme.eq_ignore_ascii_case("bearer"))
        .map(|(_, token)| token.trim());
    let authorized =
        presented.is_some_and(|token| bool::from(token.as_bytes().ct_eq(state.token.expose())));
    if !authorized {
        let mut response = error(
            StatusCode::UNAUTHORIZED,
            ErrorCode::Unauthorized,
            "a valid bearer credential is required".into(),
        );
        response
            .headers_mut()
            .insert(header::WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
        return response;
    }
    next.run(request).await
}

async fn time_limit(request: Request, next: Next) -> Response {
    match tokio::time::timeout(REQUEST_TIMEOUT, next.run(request)).await {
        Ok(response) => response,
        Err(_) => error(
            StatusCode::REQUEST_TIMEOUT,
            ErrorCode::Timeout,
            format!(
                "request did not complete within {} s",
                REQUEST_TIMEOUT.as_secs()
            ),
        ),
    }
}

/// At most `max` characters of `text`. By characters, never bytes: `String::truncate` at a
/// byte offset panics inside a multi-byte character, and the path and serde's messages
/// both carry caller-chosen UTF-8 (a raw `é` straddling byte 128 of a path did exactly
/// that, unauthenticated — `hostile_utf8_is_clipped_not_panicked_on`).
fn clip(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

fn is_valid_request_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_REQUEST_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
}

/// A process-unique id for callers that sent none (or an unusable one). Process start
/// time plus a counter: unique enough to correlate log lines, and no RNG dependency.
fn mint_request_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    static EPOCH: std::sync::OnceLock<u128> = std::sync::OnceLock::new();
    let epoch = EPOCH.get_or_init(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    });
    format!(
        "svc-{epoch:x}-{:x}",
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

/// Correlation, timing and the single access-log line.
///
/// The request id is the caller's (`x-request-id`) when it is well-formed, so one id
/// threads both processes' logs; otherwise one is minted. `Server-Timing: app` is the
/// service's own processing time — the caller subtracts it from its round trip to see
/// what the network and the host's proxy cost. The log line carries method, path,
/// status, duration and request id: never headers (the credential), never a body, never
/// a query string.
async fn observe(request: Request, next: Next) -> Response {
    let started = Instant::now();
    let request_id = request
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .filter(|id| is_valid_request_id(id))
        .map(str::to_owned)
        .unwrap_or_else(mint_request_id);
    // Both bounded: http accepts arbitrarily long extension methods and paths, and one
    // oversized log line breaks "one JSON object per line" for log shippers.
    let method = clip(request.method().as_str(), 16);
    let path = clip(request.uri().path(), 128);

    let mut response = next.run(request).await;
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;

    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        headers.insert(REQUEST_ID_HEADER, value);
    }
    if let Ok(value) = HeaderValue::from_str(&format!("app;dur={elapsed_ms:.3}")) {
        headers.insert("server-timing", value);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));

    println!(
        "{}",
        serde_json::json!({
            "event": "request",
            "requestId": request_id,
            "method": method,
            "path": path,
            "status": response.status().as_u16(),
            "ms": (elapsed_ms * 1000.0).round() / 1000.0,
        })
    );
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use serde_json::{Value, json};
    use tower::ServiceExt;

    const TOKEN: &str = "test-token-0123456789abcdef0123456789";

    fn app() -> Router {
        let config = crate::config::Config::from_lookup(|key| {
            (key == "SERVICE_TOKEN").then(|| TOKEN.to_owned())
        })
        .expect("test config");
        router(Arc::new(AppState {
            token: config.token,
            started: Instant::now(),
        }))
    }

    async fn send(
        request: axum::http::Request<Body>,
    ) -> (StatusCode, axum::http::HeaderMap, Value) {
        let response = app().oneshot(request).await.expect("infallible");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).expect("every response is JSON")
        };
        (status, headers, body)
    }

    fn get(path: &str, token: Option<&str>) -> axum::http::Request<Body> {
        let mut builder = axum::http::Request::get(path);
        if let Some(token) = token {
            builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        builder.body(Body::empty()).unwrap()
    }

    fn post_evaluate(body: impl Into<Body>, token: Option<&str>) -> axum::http::Request<Body> {
        let mut builder = axum::http::Request::post("/v1/evaluate")
            .header(header::CONTENT_TYPE, "application/json");
        if let Some(token) = token {
            builder = builder.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        builder.body(body.into()).unwrap()
    }

    fn error_code(body: &Value) -> &str {
        body["error"]["code"].as_str().expect("error envelope")
    }

    #[tokio::test]
    async fn liveness_is_public_and_says_nothing_else() {
        let (status, headers, body) = send(get("/health/live", None)).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body, json!({ "status": "live" }));
        assert!(headers.contains_key(REQUEST_ID_HEADER));
        assert!(
            headers["server-timing"]
                .to_str()
                .unwrap()
                .starts_with("app;dur=")
        );
        assert_eq!(headers[header::CACHE_CONTROL], "no-store");
    }

    #[tokio::test]
    async fn functional_routes_refuse_missing_and_wrong_credentials() {
        for request in [
            get("/v1/status", None),
            get("/v1/status", Some("wrong-token-0123456789abcdef0123456789")),
            get("/v1/status", Some(&TOKEN[..TOKEN.len() - 1])),
            post_evaluate(r#"{"totalCents":1,"events":[{"type":"ship"}]}"#, None),
            // Unauthenticated garbage is refused as unauthenticated, not judged as input.
            post_evaluate("not json", None),
        ] {
            let (status, headers, body) = send(request).await;
            assert_eq!(status, StatusCode::UNAUTHORIZED);
            assert_eq!(error_code(&body), "unauthorized");
            assert_eq!(headers[header::WWW_AUTHENTICATE], "Bearer");
        }
    }

    #[tokio::test]
    async fn status_reports_identity_and_limits() {
        let (status, _, body) = send(get("/v1/status", Some(TOKEN))).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["service"], "runtime-lab");
        assert_eq!(body["release"], env!("CARGO_PKG_VERSION"));
        assert!(body["uptimeMs"].is_u64());
        assert_eq!(body["operations"], json!(["evaluate"]));
        assert_eq!(
            body["limits"],
            json!({ "maxEvents": 64, "maxAmountCents": 100_000_000, "maxBodyBytes": 8192 })
        );
    }

    #[tokio::test]
    async fn the_bearer_scheme_is_case_insensitive() {
        let request = axum::http::Request::get("/v1/status")
            .header(header::AUTHORIZATION, format!("bearer {TOKEN}"))
            .body(Body::empty())
            .unwrap();
        assert_eq!(send(request).await.0, StatusCode::OK);
    }

    #[tokio::test]
    async fn an_accepted_evaluation_returns_steps_and_ledger() {
        let body = json!({
            "totalCents": 1000,
            "events": [{ "type": "pay", "amountCents": 1000 }, { "type": "ship" }, { "type": "deliver" }]
        });
        let (status, _, body) = send(post_evaluate(body.to_string(), Some(TOKEN))).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["outcome"], "accepted");
        assert_eq!(body["finalState"], "delivered");
        assert_eq!(body["paidCents"], 1000);
        assert_eq!(
            body["steps"][0],
            json!({ "index": 0, "event": "pay", "from": "placed", "to": "paid" })
        );
    }

    #[tokio::test]
    async fn a_refusal_is_a_200_answer_not_an_error() {
        let body = json!({ "totalCents": 1000, "events": [{ "type": "ship" }] });
        let (status, _, body) = send(post_evaluate(body.to_string(), Some(TOKEN))).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["outcome"], "refused");
        assert_eq!(
            body["refusal"],
            json!({ "index": 0, "event": "ship", "state": "placed", "reason": "payment_incomplete" })
        );
        assert_eq!(body["steps"], json!([]));
    }

    #[tokio::test]
    async fn invalid_input_never_reaches_the_rules() {
        let cases = [
            "not json".to_owned(),
            json!({ "totalCents": 100 }).to_string(),
            json!({ "totalCents": 100, "events": [], "extra": true }).to_string(),
            json!({ "totalCents": 100, "events": [{ "type": "teleport" }] }).to_string(),
            json!({ "totalCents": 100, "events": [{ "type": "ship", "amountCents": 5 }] })
                .to_string(),
            json!({ "totalCents": -1, "events": [{ "type": "ship" }] }).to_string(),
            json!({ "totalCents": 0, "events": [{ "type": "ship" }] }).to_string(),
            json!({ "totalCents": 100, "events": [] }).to_string(),
            json!({ "totalCents": 100, "events": [{ "type": "pay", "amountCents": 0 }] })
                .to_string(),
            json!({ "totalCents": 100, "events": vec![json!({ "type": "ship" }); 65] }).to_string(),
        ];
        for case in cases {
            let (status, _, body) = send(post_evaluate(case.clone(), Some(TOKEN))).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{case}");
            assert_eq!(error_code(&body), "invalid_request", "{case}");
        }
    }

    #[tokio::test]
    async fn the_validation_message_points_at_the_field() {
        let body = json!({ "totalCents": 100, "events": [{ "type": "ship" }, { "type": "pay", "amountCents": 0 }] });
        let (_, _, body) = send(post_evaluate(body.to_string(), Some(TOKEN))).await;
        assert!(
            body["error"]["message"]
                .as_str()
                .unwrap()
                .starts_with("/events/1/amountCents")
        );
    }

    #[tokio::test]
    async fn oversized_bodies_are_refused_before_parsing() {
        let padding = "x".repeat(MAX_BODY_BYTES + 1);
        let (status, _, body) = send(post_evaluate(padding, Some(TOKEN))).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(error_code(&body), "payload_too_large");
    }

    #[tokio::test]
    async fn unknown_routes_and_methods_use_the_envelope() {
        let (status, _, body) = send(get("/admin", None)).await;
        assert_eq!(
            (status, error_code(&body)),
            (StatusCode::NOT_FOUND, "not_found")
        );
        let request = axum::http::Request::delete("/health/live")
            .body(Body::empty())
            .unwrap();
        let (status, _, body) = send(request).await;
        assert_eq!(
            (status, error_code(&body)),
            (StatusCode::METHOD_NOT_ALLOWED, "method_not_allowed")
        );
    }

    #[tokio::test]
    async fn hostile_utf8_is_clipped_not_panicked_on() {
        // `é` occupies bytes 127–128 of the path: byte 128 is not a character boundary.
        let path = format!("/{}é", "a".repeat(126));
        let (status, _, body) = send(get(&path, None)).await;
        assert_eq!(
            (status, error_code(&body)),
            (StatusCode::NOT_FOUND, "not_found")
        );

        // Same hazard behind auth: serde echoes an unknown name into the message. Vary the
        // ASCII prefix so a 3-byte `€` straddles the cut point at every alignment.
        for pad in 0..4 {
            let kind = format!("{}{}", "x".repeat(pad), "€".repeat(120));
            let request = format!(r#"{{"totalCents":1,"events":[{{"type":"{kind}"}}]}}"#);
            let (status, _, body) = send(post_evaluate(request, Some(TOKEN))).await;
            assert_eq!(
                (status, error_code(&body)),
                (StatusCode::BAD_REQUEST, "invalid_request"),
                "pad {pad}"
            );
            assert!(body["error"]["message"].as_str().unwrap().chars().count() <= 240);
        }
    }

    #[test]
    fn clip_counts_characters_not_bytes() {
        assert_eq!(clip("aé", 2), "aé");
        assert_eq!(clip("éé", 1), "é");
        assert_eq!(clip("abc", 10), "abc");
    }

    #[tokio::test]
    async fn a_well_formed_caller_request_id_is_echoed_and_a_hostile_one_replaced() {
        let echoed = axum::http::Request::get("/health/live")
            .header(REQUEST_ID_HEADER, "req-1234_abc.def")
            .body(Body::empty())
            .unwrap();
        assert_eq!(send(echoed).await.1[REQUEST_ID_HEADER], "req-1234_abc.def");

        for hostile in ["has space", "a\"quote", &"x".repeat(MAX_REQUEST_ID_LEN + 1)] {
            let request = axum::http::Request::get("/health/live")
                .header(REQUEST_ID_HEADER, hostile)
                .body(Body::empty())
                .unwrap();
            let id = send(request).await.1[REQUEST_ID_HEADER]
                .to_str()
                .unwrap()
                .to_owned();
            assert!(id.starts_with("svc-"), "{hostile} → {id}");
        }
    }
}
