# Deployment

Tri-target deployment: Vercel (Node.js), Vercel (Bun experimental), and Koyeb (Bun container).

**Strategy:** Same codebase, different configurations. See [stack/deployment.md](../stack/deployment.md) for decision rationale.

---

## Quick Start

```bash
# Vercel (Node.js) — Stable
bun run build
# Deploy via Vercel dashboard or CLI

# Vercel (Bun) — Experimental
bun run build
# Add "bunVersion": "1.x" to vercel.json

# Koyeb (Bun) — Container
DEPLOY_TARGET=bun bun run build
# Deploy via Dockerfile
```

---

## Adapter Configuration

### Dynamic Adapter Selection

```javascript
// svelte.config.js
import adapterVercel from '@sveltejs/adapter-vercel';
import adapterBun from 'svelte-adapter-bun';

const target = process.env.DEPLOY_TARGET;

const adapter = target === 'bun'
  ? adapterBun({ precompress: true })
  : adapterVercel();

export default {
  kit: {
    adapter,
  },
};
```

### Adapter Dependencies

Dev dependencies:
```json
"@sveltejs/adapter-vercel": "^5.x",
"svelte-adapter-bun": "^0.5.x"
```

> See [development-environment.md](./development-environment.md) for installation workflow.

### Package.json Scripts

```json
{
  "scripts": {
    "build": "vite build",
    "build:vercel": "vite build",
    "build:bun": "DEPLOY_TARGET=bun vite build",
    "preview": "vite preview",
    "preview:bun": "DEPLOY_TARGET=bun bun run build && bun ./build/index.js"
  }
}
```

---

## Vercel Deployment (Node.js)

### Setup

1. **Connect repository** to Vercel dashboard
2. **Framework preset:** SvelteKit (auto-detected)
3. **Build command:** `bun run build` (default)
4. **Output directory:** `.vercel/output` (auto-configured)

### vercel.json

```json
{
  "framework": "sveltekit",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/session-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Vercel cron calls are authenticated with `CRON_SECRET`. See [Scheduled Jobs](#scheduled-jobs) below.

### Environment Variables

Set in Vercel dashboard → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon connection string |
| `RATE_LIMIT_SECRET` | Yes | 32+ char secret |
| `CRON_SECRET` | Yes | Bearer token for cron endpoints |
| `R2_ENDPOINT` | If using R2 | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | If using R2 | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | If using R2 | R2 credentials |

### Adapter Options

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter({
      // Deploy to edge (faster, limited Node.js APIs)
      runtime: 'edge',

      // Or use Node.js runtime (full API support)
      runtime: 'nodejs22.x',

      // Split routes into separate functions
      split: true,

      // Memory limit (MB)
      memory: 1024,

      // Timeout (seconds)
      maxDuration: 10,
    }),
  },
};
```

### Preview Deploys

Vercel creates preview deployments for every PR:

```
https://velociraptor-<hash>-<team>.vercel.app
```

Configure preview environment variables separately in Vercel dashboard.

---

## Vercel Deployment (Bun) — Experimental

> **Warning:** Vercel's Bun runtime officially supports Next.js, Express, Hono, and Nitro. SvelteKit is **not officially listed** but may work. Test thoroughly before production use.

### Why Try This?

- 28% lower latency compared to Node.js (Vercel benchmarks)
- Same Vercel DX (preview deploys, dashboard, analytics)
- One config line to enable
- Easy to revert if issues arise

### Setup

Same as Node.js deployment, plus one addition to `vercel.json`:

```json
{
  "framework": "sveltekit",
  "bunVersion": "1.x",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/session-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

The key addition is `"bunVersion": "1.x"` which enables Bun runtime for all functions.

### What Changes

| Aspect | Node.js | Bun |
|--------|---------|-----|
| Runtime | Node.js 20 | Bun 1.x |
| Cold starts | ~200-500ms | ~150-350ms (estimated) |
| Adapter | `adapter-vercel` | `adapter-vercel` (same) |
| Build | `bun run build` | `bun run build` (same) |
| Config | Default | Add `bunVersion` |

### Testing Strategy

1. **Deploy to preview first** — Don't go straight to production
2. **Test all routes** — Server functions, API endpoints, load functions
3. **Check edge cases** — File uploads, WebSockets, streaming
4. **Monitor errors** — Watch Vercel logs for Bun-specific issues
5. **Compare performance** — Measure latency vs Node.js deployment

### Reverting to Node.js

If issues arise, simply remove the `bunVersion` line:

```json
{
  "framework": "sveltekit",
  "regions": ["iad1"]
}
```

Redeploy and you're back on Node.js.

### Known Limitations

| Feature | Status |
|---------|--------|
| SvelteKit SSR | Should work (uses adapter-vercel) |
| API routes | Should work |
| Edge runtime | Unknown (test needed) |
| Streaming | Should work |
| WebSockets | Unknown (test needed) |
| Native Node modules | May have issues |

### Reporting Issues

If SvelteKit + Bun works well, consider:
- Sharing results in [Vercel Community](https://github.com/vercel/community/discussions)
- Opening issue to request official SvelteKit support

---

## Koyeb Deployment (Bun)

### Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# ============================================
# Base image
# ============================================
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ============================================
# Install dependencies
# ============================================
FROM base AS deps

# Copy package files
COPY package.json bun.lockb ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# ============================================
# Build stage
# ============================================
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment
ENV NODE_ENV=production
ENV DEPLOY_TARGET=bun

# Build the application
RUN bun run build

# ============================================
# Production dependencies only
# ============================================
FROM base AS prod-deps

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# ============================================
# Production image
# ============================================
FROM base AS runner

# Security: run as non-root user
USER bun

# Copy production dependencies
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=bun:bun /app/build ./build
COPY --from=builder --chown=bun:bun /app/package.json ./

# Environment variables for reverse proxy
ENV NODE_ENV=production
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=x-forwarded-host
ENV PORT=3000

EXPOSE 3000

# Start the application
CMD ["bun", "run", "./build/index.js"]
```

### .dockerignore

```
node_modules
.svelte-kit
build
.env*
.git
.gitignore
*.md
Dockerfile
.dockerignore
```

### Koyeb Setup

1. **Sign up** at [koyeb.com](https://www.koyeb.com) (no credit card required)

2. **Create app** → Select GitHub repository

3. **Builder:** Dockerfile

4. **Instance type:** Nano (free tier)
   - 512 MB RAM
   - 0.1 vCPU
   - Frankfurt or Washington D.C.

5. **Environment variables:** Add in Koyeb dashboard

6. **Port:** 3000

### Environment Variables

Set in Koyeb dashboard → Service → Settings → Environment:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon connection string |
| `RATE_LIMIT_SECRET` | Yes | 32+ char secret |
| `ORIGIN` | Yes | `https://your-app.koyeb.app` |
| `R2_ENDPOINT` | If using R2 | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | If using R2 | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | If using R2 | R2 credentials |

### Adapter Options

```javascript
// svelte.config.js
import adapter from 'svelte-adapter-bun';

export default {
  kit: {
    adapter: adapter({
      // Enable gzip/brotli compression
      precompress: true,

      // Development mode logging
      development: false,

      // Dynamic imports for routes
      dynamic_origin: true,

      // WebSocket support (experimental)
      websocket: false,
    }),
  },
};
```

### Local Testing

Test the Docker build locally:

```bash
# Build image
podman build -t velociraptor .

# Run container
podman run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e ORIGIN="http://localhost:3000" \
  velociraptor

# Open http://localhost:3000
```

---

## Scheduled Jobs

Recurring background work runs differently per platform. The same job registry serves both.

### How it works

| Platform | Trigger | Entry point |
|----------|---------|-------------|
| Vercel | HTTP cron via `vercel.json` | `GET /api/cron/[job]` |
| Container | `setInterval` in `hooks.server.ts` | Direct function call |

**Platform detection** — `src/lib/server/platform/index.ts` reads `$env/dynamic/private`. If `VERCEL` is set, `platform.persistent = false` and the scheduler is a no-op. If `CONTAINER=1`, `platform.persistent = true` and the scheduler starts.

**Job registry** — `src/lib/server/jobs/index.ts` maps slugs to `execute()` functions. Both trigger paths call the same registry.

```typescript
// src/lib/server/jobs/index.ts
export const jobs: Record<string, Job> = {
  'session-cleanup': { execute: sessionCleanup },
};
```

### Adding a job

1. Write a pure function in `src/lib/server/jobs/`:

```typescript
// src/lib/server/jobs/my-job.ts
export async function myJob(): Promise<number> {
  // do work, return count of affected rows
  return affectedCount;
}
```

2. Register it:

```typescript
// src/lib/server/jobs/index.ts
import { myJob } from './my-job';

export const jobs: Record<string, Job> = {
  'session-cleanup': { execute: sessionCleanup },
  'my-job': { execute: myJob },           // add this line
};
```

3. Add a Vercel cron entry (Vercel only):

```json
{
  "crons": [
    { "path": "/api/cron/session-cleanup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/my-job", "schedule": "0 4 * * *" }
  ]
}
```

Container mode runs all registered jobs on the same interval (`JOB_INTERVAL_MS`, default 3 hours). Vercel crons can have independent schedules.

### HTTP endpoint

`GET /api/cron/[job]` requires a bearer token:

```
Authorization: Bearer <CRON_SECRET>
```

Vercel sends this automatically when `CRON_SECRET` is set in the dashboard. The `CRON_SECRET` value must match across `vercel.json` config and the dashboard environment variable.

Returns:
```json
{ "success": true, "deleted": 42 }
```

Returns `401` if the token is missing or wrong. Returns `404` if the job slug is not in the registry.

### Scheduler behaviour (container)

- Runs 5 seconds after startup (catches expired sessions immediately)
- Repeats every `JOB_INTERVAL_MS` milliseconds (default: `10800000` = 3 hours)
- `globalThis.__v10r_scheduler` prevents duplicate intervals on HMR restarts
- `timer.unref()` lets the process exit cleanly without a pending interval
- Clears on `SIGTERM` for graceful shutdown

### Environment variables

| Variable | Platform | Notes |
|----------|----------|-------|
| `CRON_SECRET` | Both | Bearer token for HTTP cron endpoint. Generate with `openssl rand -base64 32` |
| `CONTAINER` | Container | Set to `1` in `compose.yaml`. Tells platform detector this is a persistent process |
| `JOB_INTERVAL_MS` | Container | Interval in ms. Omit to use the 3-hour default |
| `VERCEL` | Vercel | Set automatically by Vercel. Disables in-process scheduler |

---

## CI/CD Pipeline

### GitLab CI (All Targets)

```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

variables:
  BUN_VERSION: "1.1"

# Build for Vercel
build:vercel:
  stage: build
  image: oven/bun:1
  script:
    - bun install --frozen-lockfile
    - bun run build
  artifacts:
    paths:
      - .vercel/output
  only:
    - main

# Build for Koyeb
build:koyeb:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  only:
    - main

# Deploy to Vercel
deploy:vercel:
  stage: deploy
  image: node:20-alpine
  script:
    - npx vercel --prod --token=$VERCEL_TOKEN
  needs:
    - build:vercel
  only:
    - main

# Deploy to Koyeb
deploy:koyeb:
  stage: deploy
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST "https://app.koyeb.com/v1/services/$KOYEB_SERVICE_ID/redeploy" \
        -H "Authorization: Bearer $KOYEB_API_TOKEN"
  needs:
    - build:koyeb
  only:
    - main
```

### GitHub Actions (All Targets)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-vercel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile
      - run: bun run build

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-koyeb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker image
        run: |
          echo "${{ secrets.KOYEB_DOCKER_TOKEN }}" | docker login -u koyeb --password-stdin
          docker build -t koyeb.io/${{ secrets.KOYEB_APP }}:${{ github.sha }} .
          docker push koyeb.io/${{ secrets.KOYEB_APP }}:${{ github.sha }}

      - name: Deploy to Koyeb
        run: |
          curl -X PATCH "https://app.koyeb.com/v1/services/${{ secrets.KOYEB_SERVICE_ID }}" \
            -H "Authorization: Bearer ${{ secrets.KOYEB_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"definition":{"docker":{"image":"koyeb.io/${{ secrets.KOYEB_APP }}:${{ github.sha }}"}}}'
```

---

## Database Migrations

### Vercel

Add to build command in Vercel dashboard:

```bash
bun run db:migrate && bun run build
```

Or use Vercel's build hooks:

```json
{
  "buildCommand": "bun run db:migrate && bun run build"
}
```

### Koyeb

Run migrations before starting the app in Dockerfile:

```dockerfile
# Add migration step
CMD ["sh", "-c", "bun run db:migrate && bun run ./build/index.js"]
```

Or use a separate migration job:

```bash
# Run migration manually
koyeb service exec <service> -- bun run db:migrate
```

---

## Health Checks

### Koyeb Health Check

Configure in Koyeb dashboard → Service → Health checks:

| Setting | Value |
|---------|-------|
| Path | `/api/health` |
| Port | 3000 |
| Period | 30s |
| Timeout | 5s |

### Health Endpoint

```typescript
// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);

    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      { status: 'unhealthy', error: 'Database connection failed' },
      { status: 503 }
    );
  }
}
```

---

## Cold Starts

### Vercel

- Edge runtime: ~50ms cold start
- Node.js runtime: ~200-500ms cold start
- Mitigate: Use edge runtime for latency-sensitive routes

### Koyeb

- Free tier: Service sleeps after inactivity
- Cold start: 10-30 seconds
- Mitigate: Implement loading states, use keep-alive ping

```typescript
// Keep-alive cron (external service like cron-job.org)
// Ping /api/health every 5 minutes to prevent sleep
```

---

## Debugging

### Vercel Logs

```bash
# View logs (requires Vercel CLI on host machine)
vercel logs <deployment-url>

# Stream logs
vercel logs <deployment-url> --follow
```

> **Note:** Vercel CLI is installed globally on your host machine, not in the container.

### Koyeb Logs

```bash
# Install Koyeb CLI
curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh

# View logs
koyeb service logs <service-name>

# Stream logs
koyeb service logs <service-name> --follow
```

---

## Environment Variable Checklist

| Variable | Vercel | Koyeb | Required |
|----------|--------|-------|----------|
| `DATABASE_URL` | Dashboard | Dashboard | Yes |
| `ORIGIN` | Auto | Manual | Yes (Koyeb) |
| `RATE_LIMIT_SECRET` | Dashboard | Dashboard | Yes |
| `CRON_SECRET` | Dashboard | Dashboard | If using crons |
| `CONTAINER` | Not used | `compose.yaml` | Container only |
| `JOB_INTERVAL_MS` | Not used | Dashboard | Container only, optional |
| `R2_ENDPOINT` | Dashboard | Dashboard | If using R2 |
| `R2_ACCESS_KEY_ID` | Dashboard | Dashboard | If using R2 |
| `R2_SECRET_ACCESS_KEY` | Dashboard | Dashboard | If using R2 |
| `PROTOCOL_HEADER` | Auto | Dockerfile | Koyeb only |
| `HOST_HEADER` | Auto | Dockerfile | Koyeb only |

---

## File Structure

```
/
├── Dockerfile              # Koyeb container build
├── .dockerignore           # Docker build exclusions
├── vercel.json             # Vercel configuration (crons, regions)
├── compose.yaml            # Local dev (sets CONTAINER=1)
├── svelte.config.js        # Adapter selection
├── .gitlab-ci.yml          # GitLab CI/CD
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions
└── src/
    ├── hooks.server.ts     # Imports scheduler (bare import activates it)
    ├── lib/server/
    │   ├── platform/
    │   │   ├── types.ts    # PlatformId, PlatformInfo
    │   │   └── index.ts    # Platform detection (VERCEL vs CONTAINER)
    │   └── jobs/
    │       ├── index.ts    # Job registry (slug → execute fn)
    │       ├── scheduler.ts# In-process scheduler (containers only)
    │       └── session-cleanup.ts  # Deletes expired sessions
    └── routes/api/cron/
        └── [job]/
            └── +server.ts  # HTTP trigger (Vercel crons)
```

---

## Summary

| Step | Vercel (Node.js) | Vercel (Bun) | Koyeb (Bun) |
|------|------------------|--------------|-------------|
| Adapter | `adapter-vercel` | `adapter-vercel` | `svelte-adapter-bun` |
| Build | `bun run build` | `bun run build` | `DEPLOY_TARGET=bun bun run build` |
| Config | Default | Add `bunVersion: "1.x"` | Dockerfile |
| Deploy | Git push | Git push | Dockerfile → dashboard |
| Status | Stable | Experimental | Stable |
| Logs | `vercel logs` | `vercel logs` | `koyeb service logs` |
| Scheduled jobs | HTTP cron via `vercel.json` | HTTP cron via `vercel.json` | `setInterval` in process |

---

## Related

- [stack/deployment.md](../stack/deployment.md) - Decision rationale
- [rate-limiting.md](./rate-limiting.md) - Rate limiting configuration
- [middleware.md](./middleware.md) - Request handling
- [error-handling.md](./error-handling.md) - Error pages and logging
