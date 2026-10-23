//! runtime-lab — v10r's reference external service.
//!
//! `runtime-lab`          serve HTTP until SIGTERM / Ctrl-C, then drain and exit 0
//! `runtime-lab openapi`  print the OpenAPI document (the source of `openapi.json`)
//!
//! Configuration is environment-only (`config.rs`): `SERVICE_TOKEN` (required, ≥32
//! characters), `PORT` (default 8080), `HOST` (default 0.0.0.0). Logs are one JSON
//! object per line on stdout, the format container hosts collect without an agent.

mod config;
mod contract;
mod http;
mod order;

use std::process::ExitCode;
use std::sync::Arc;
use std::time::{Duration, Instant};

use hyper::server::conn::http1;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::server::graceful::GracefulShutdown;
use hyper_util::service::TowerToHyperService;
use tokio::sync::Semaphore;

use crate::config::Config;
use crate::http::AppState;

fn log(event: serde_json::Value) {
    println!("{event}");
}

fn openapi_json() -> String {
    http::openapi()
        .to_pretty_json()
        .expect("the OpenAPI document always serializes")
}

fn main() -> ExitCode {
    // Uptime counts from process start, so a cold start's boot time is part of what
    // `/v1/status` reports — that is the number a caller needs to recognise one.
    let started = Instant::now();

    if std::env::args().nth(1).as_deref() == Some("openapi") {
        println!("{}", openapi_json());
        return ExitCode::SUCCESS;
    }

    let config = match Config::from_lookup(|key| std::env::var(key).ok()) {
        Ok(config) => config,
        Err(reason) => {
            // Fail closed: no credential, no service. Exit code 2 = configuration.
            log(serde_json::json!({ "event": "config_refused", "reason": reason.to_string() }));
            return ExitCode::from(2);
        }
    };

    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(err) => {
            log(serde_json::json!({ "event": "runtime_failed", "reason": err.to_string() }));
            return ExitCode::FAILURE;
        }
    };

    match runtime.block_on(serve(config, started)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            log(serde_json::json!({ "event": "serve_failed", "reason": err.to_string() }));
            ExitCode::FAILURE
        }
    }
}

/// A client must finish sending a request head within this, and an idle keep-alive
/// connection is closed after it. `REQUEST_TIMEOUT` only starts once a head is parsed, so
/// without this a client trickling header bytes (slowloris) holds a socket forever.
const HEADER_READ_TIMEOUT: Duration = Duration::from_secs(5);
/// Open connections at once. Past it, new connections are closed on accept: the process
/// stays responsive to the ones it has instead of exhausting file descriptors.
const MAX_CONNECTIONS: usize = 256;
/// Longest wait for in-flight requests after SIGTERM — inside the 30 s hosts allow.
const DRAIN_LIMIT: Duration = Duration::from_secs(10);

/// The accept loop. Written out instead of `axum::serve` because the two protections
/// above are connection-level settings `axum::serve` does not expose.
async fn serve(config: Config, started: Instant) -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind(config.addr).await?;
    log(serde_json::json!({
        "event": "listening",
        "addr": config.addr.to_string(),
        "release": env!("CARGO_PKG_VERSION"),
        "bootMs": started.elapsed().as_secs_f64() * 1000.0,
    }));

    let app = http::router(Arc::new(AppState {
        token: config.token,
        started,
    }));
    let slots = Arc::new(Semaphore::new(MAX_CONNECTIONS));
    let graceful = GracefulShutdown::new();
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            accepted = listener.accept() => {
                let stream = match accepted {
                    Ok((stream, _)) => stream,
                    // EMFILE and friends: back off briefly instead of spinning.
                    Err(_) => {
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        continue;
                    }
                };
                let Ok(slot) = slots.clone().try_acquire_owned() else {
                    continue; // over capacity: dropping the stream closes it
                };
                let connection = http1::Builder::new()
                    .timer(TokioTimer::new())
                    .header_read_timeout(HEADER_READ_TIMEOUT)
                    .serve_connection(TokioIo::new(stream), TowerToHyperService::new(app.clone()));
                let connection = graceful.watch(connection);
                tokio::spawn(async move {
                    let _ = connection.await;
                    drop(slot);
                });
            }
            () = &mut shutdown => break,
        }
    }

    drop(listener);
    if tokio::time::timeout(DRAIN_LIMIT, graceful.shutdown())
        .await
        .is_err()
    {
        log(serde_json::json!({ "event": "drain_timeout" }));
    }
    log(serde_json::json!({ "event": "stopped" }));
    Ok(())
}

/// Resolves on SIGTERM (container stop, host redeploy) or Ctrl-C. After it resolves the
/// server stops accepting, lets in-flight requests finish (each bounded by
/// `http::REQUEST_TIMEOUT`) and closes idle connections, for at most `DRAIN_LIMIT`.
async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }
    log(serde_json::json!({ "event": "draining" }));
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The committed `openapi.json` is the contract v10r generates its types from. This
    /// test is what makes the Rust code its authority: change a wire type or a route and
    /// the file is stale until regenerated (`UPDATE_OPENAPI=1 cargo test`), which in
    /// turn makes v10r's contract test fail until its types are regenerated.
    #[test]
    fn openapi_json_matches_the_code() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/openapi.json");
        let generated = format!("{}\n", openapi_json());
        if std::env::var_os("UPDATE_OPENAPI").is_some() {
            std::fs::write(path, &generated).expect("write openapi.json");
            return;
        }
        let committed = std::fs::read_to_string(path).unwrap_or_default();
        assert!(
            committed == generated,
            "openapi.json is stale — regenerate with `UPDATE_OPENAPI=1 cargo test`, then run `bun run external-service:contract`"
        );
    }

    #[test]
    fn every_functional_route_requires_the_bearer_scheme_in_the_contract() {
        let spec: serde_json::Value = serde_json::from_str(&openapi_json()).unwrap();
        let paths = spec["paths"].as_object().unwrap();
        assert!(paths.len() >= 3, "scanned {} paths", paths.len());
        for (path, item) in paths {
            for (method, operation) in item.as_object().unwrap() {
                let secured = operation["security"] == serde_json::json!([{ "bearer": [] }]);
                assert_eq!(secured, path != "/health/live", "{method} {path}");
            }
        }
    }

    /// A minimal JSON-Schema check — just the keywords this contract uses — so the tests
    /// below can hold the published schema to what serde really reads and writes. utoipa
    /// derives the schema from the same types but not from serde's behaviour, and the two
    /// have already disagreed once (`rename_all_fields`).
    fn conforms(
        spec: &serde_json::Value,
        schema: &serde_json::Value,
        value: &serde_json::Value,
    ) -> bool {
        use serde_json::Value;
        if let Some(reference) = schema["$ref"].as_str() {
            let name = reference.trim_start_matches("#/components/schemas/");
            return conforms(spec, &spec["components"]["schemas"][name], value);
        }
        if let Some(variants) = schema["oneOf"].as_array() {
            return variants.iter().filter(|v| conforms(spec, v, value)).count() == 1;
        }
        if let Some(allowed) = schema["enum"].as_array()
            && !allowed.contains(value)
        {
            return false;
        }
        match schema["type"].as_str() {
            Some("object") => {
                let Value::Object(fields) = value else {
                    return false;
                };
                let properties = schema["properties"]
                    .as_object()
                    .cloned()
                    .unwrap_or_default();
                let required = schema["required"].as_array().cloned().unwrap_or_default();
                let closed = schema["additionalProperties"] == Value::Bool(false);
                required
                    .iter()
                    .all(|key| fields.contains_key(key.as_str().unwrap()))
                    && fields.iter().all(|(key, field)| match properties.get(key) {
                        Some(property) => conforms(spec, property, field),
                        None => !closed,
                    })
            }
            Some("array") => {
                let Value::Array(items) = value else {
                    return false;
                };
                let within = |key: &str, ok: fn(usize, u64) -> bool| {
                    schema[key].as_u64().is_none_or(|n| ok(items.len(), n))
                };
                within("minItems", |len, n| len as u64 >= n)
                    && within("maxItems", |len, n| len as u64 <= n)
                    && items
                        .iter()
                        .all(|item| conforms(spec, &schema["items"], item))
            }
            Some("integer") => value.as_i64().is_some_and(|n| {
                schema["minimum"].as_i64().is_none_or(|min| n >= min)
                    && schema["maximum"].as_i64().is_none_or(|max| n <= max)
            }),
            Some("string") => value.is_string(),
            Some(other) => panic!("unhandled schema type {other}"),
            // A type array (OpenAPI 3.1 nullability) must fail loudly, not conform by default.
            None if !schema["type"].is_null() => panic!("unhandled schema type {}", schema["type"]),
            None => true,
        }
    }

    fn schema(name: &str) -> serde_json::Value {
        serde_json::json!({ "$ref": format!("#/components/schemas/{name}") })
    }

    #[test]
    fn every_response_the_service_sends_conforms_to_the_published_schema() {
        use crate::contract::*;
        let spec: serde_json::Value = serde_json::from_str(&openapi_json()).unwrap();
        let check = |name: &str, value: serde_json::Value| {
            assert!(
                conforms(&spec, &schema(name), &value),
                "{name} does not match its schema: {value}"
            );
        };

        let events = [
            order::OrderEvent::Pay { amount_cents: 60 },
            order::OrderEvent::Pay { amount_cents: 40 },
            order::OrderEvent::Ship,
            order::OrderEvent::Deliver,
            order::OrderEvent::Refund { amount_cents: 10 },
        ];
        for (total, events) in [(100, &events[..]), (100, &events[1..])] {
            let response = EvaluateResponse::from(order::evaluate(total, events).unwrap());
            check("EvaluateResponse", serde_json::to_value(response).unwrap());
        }
        check(
            "LiveResponse",
            serde_json::to_value(LiveResponse {
                status: LiveStatus::Live,
            })
            .unwrap(),
        );
        check(
            "StatusResponse",
            serde_json::to_value(StatusResponse {
                service: "runtime-lab".into(),
                release: "0.1.0".into(),
                uptime_ms: 1,
                operations: vec![Operation::Evaluate],
                limits: ServiceLimits {
                    max_events: 64,
                    max_amount_cents: 1,
                    max_body_bytes: 1,
                },
            })
            .unwrap(),
        );
        check(
            "ErrorEnvelope",
            serde_json::to_value(ErrorEnvelope {
                error: ErrorBody {
                    code: ErrorCode::InvalidRequest,
                    message: "m".into(),
                },
            })
            .unwrap(),
        );
    }

    /// Both directions: a request the schema admits must parse, and one serde refuses must
    /// not be admitted by the schema — otherwise the published contract promises more (or
    /// less) than the service accepts.
    #[test]
    fn the_request_schema_admits_exactly_what_serde_accepts() {
        use serde_json::json;
        let spec: serde_json::Value = serde_json::from_str(&openapi_json()).unwrap();
        let samples = [
            json!({ "totalCents": 100, "events": [{ "type": "ship" }] }),
            json!({ "totalCents": 100, "events": [{ "type": "pay", "amountCents": 5 }, { "type": "cancel" }] }),
            json!({ "totalCents": 100, "events": [{ "type": "refund", "amountCents": 1 }, { "type": "deliver" }] }),
            json!({ "totalCents": 100, "events": [{ "type": "ship", "amountCents": 5 }] }),
            json!({ "totalCents": 100, "events": [{ "type": "pay" }] }),
            json!({ "totalCents": 100, "events": [{ "type": "pay", "amount_cents": 5 }] }),
            json!({ "totalCents": 100, "events": [{ "type": "teleport" }] }),
            json!({ "totalCents": 100, "events": [{ "type": "ship" }], "extra": 1 }),
            json!({ "total_cents": 100, "events": [{ "type": "ship" }] }),
            json!({ "totalCents": "100", "events": [{ "type": "ship" }] }),
        ];
        for sample in samples {
            let serde_accepts =
                serde_json::from_value::<contract::EvaluateRequest>(sample.clone()).is_ok();
            let schema_accepts = conforms(&spec, &schema("EvaluateRequest"), &sample);
            assert_eq!(
                schema_accepts, serde_accepts,
                "schema and serde disagree on {sample}"
            );
        }
    }
}
