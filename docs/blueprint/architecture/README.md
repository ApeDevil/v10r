# Architecture

Cross-cutting structural decisions — patterns that span multiple features and client types.

## Files

| File | Main Topics |
|------|-------------|
| **[multi-client-core.md](./multi-client-core.md)** | • How human UI, AI agents, REST API, and background jobs share the same domain logic<br>• The four invariants (no framework imports in domain modules, date serialization in route layer, etc.)<br>• AI tool definition pattern with `createTools(userId)` factory<br>• Auth per client type, error handling across surfaces<br>• Cross-domain boundary rules, extraction rules, what we chose not to do |
| **[jobs.md](./jobs.md)** | • Two job categories by trigger mechanism: scheduled (cron / `setInterval`) and manual (admin)<br>• Vendor-agnostic scheduling: the registry owns the job (`slug → { execute }`), platform adapters own the schedule<br>• Scheduler: flat `setInterval` over the registry on the persistent container (gated on `platform.persistent`); Vercel cron + `/api/cron/[job]` on serverless<br>• Registered jobs: `session-cleanup`, `log-cleanup`, `grant-request-expiry`, …<br>• Execution and observability: unified `job_execution` table across all trigger types<br>• Platform constraints (Vercel timeouts, Neon PgBouncer, cron gotchas)<br>• Security: auth per trigger type, hardening checklist<br>• Technology decisions: custom registry chosen; pg-boss/BullMQ/Trigger.dev rejected with rationale |
