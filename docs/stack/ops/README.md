# Ops

Operations, deployment, and observability.

## Contents

| File | Main Topics |
|------|-------------|
| **[deployment.md](./deployment.md)** | • Vercel serverless (live), • Container target (planned), • Adapter selection, • Environment parity |
| **[shipping.md](./shipping.md)** | • "Ship it" in the conversation → squash merge → GitHub `main`, • development vs shipping mode, • `gitlab-sync.yml` (GitHub `main` → GitLab `main`, fast-forward only), • Vercel verification states, • one-time GitHub/GitLab setup, • recovery |
| **[dev-cli.md](./dev-cli.md)** | • `vr` dispatcher (cwd-aware, any repo), • compose-derived container/service + `.vrrc` git overrides, • ship train (feature→dev→main; branch-only under `PROMOTION=conversation`), • container-gated validate, • `vr ref` refresh chain (registry → excerpts → RAG ingest), • rollback & safety flags |
| **[hosting.md](./hosting.md)** | • Domain strategy, • Subdomain setup, • Platform configuration |
| **[logging.md](./logging.md)** | • Console-based logging (no Pino/Sentry), • `handleError` errorId envelope, • Vercel Logs, • What never to log |
| **[caching.md](./caching.md)** | • Edge caching, • Redis/Upstash, • Cache strategies |
