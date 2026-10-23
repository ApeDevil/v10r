# runtime-lab

v10r's reference **external service** — the second runtime v10r deploys and measures. What it serves: a deterministic order-lifecycle rules engine behind an authenticated HTTP API, in its own container. The pattern, its contract chain, security model, Render setup and measurements: [`docs/blueprint/architecture/external-service.md`](../../docs/blueprint/architecture/external-service.md). The live demo: `/showcases/external-service`.

| File | Role |
|---|---|
| `src/order.rs` | the domain — pure, no HTTP |
| `src/contract.rs` | wire types + OpenAPI document (the API's single authority) |
| `src/http.rs` | routes, bearer auth, bounds, request id, `Server-Timing`, access log |
| `src/config.rs` | `SERVICE_TOKEN` (required, ≥32 chars), `PORT` (8080), `HOST` (0.0.0.0) |
| `openapi.json` | generated contract — `UPDATE_OPENAPI=1 cargo test` |
| `check-manifest.json` | written by `scripts/external-service/check.sh` when fmt, clippy and tests pass |
| `Containerfile` | the one image for Podman and Render (context: this directory) |
| `render.yaml` | Render Blueprint — prepared, not applied |

```bash
bash scripts/external-service/check.sh    # Rust gate (pinned container; --host for local cargo)
bash scripts/external-service/smoke.sh    # build + exercise the image
podman compose --profile external-service up -d runtime-lab
```
