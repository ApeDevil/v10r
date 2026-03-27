# Architecture

Cross-cutting structural decisions — patterns that span multiple features and client types.

## Files

| File | Main Topics |
|------|-------------|
| **[multi-client-core.md](./multi-client-core.md)** | • How human UI, AI agents, REST API, and background jobs share the same domain logic<br>• The four invariants (no framework imports in domain modules, date serialization in route layer, etc.)<br>• AI tool definition pattern with `createTools(userId)` factory<br>• Auth per client type, error handling across surfaces<br>• Cross-domain boundary rules, extraction rules, what we chose not to do |
| **[jobs.md](./jobs.md)** | • Three job categories: scheduled (cron), reactive (Inngest), manual (admin)<br>• Vendor-agnostic scheduling: registry owns schedules, platform adapters read them<br>• Module structure: `jobs/` for scheduled+manual, `inngest/` for reactive (5th adapter)<br>• Execution and observability: unified `job_execution` table across all trigger types<br>• Platform constraints (Vercel timeouts, Neon PgBouncer, cron gotchas)<br>• Security: auth per trigger type, hardening checklist<br>• Technology decisions: Inngest chosen, pg-boss/BullMQ/Trigger.dev rejected with rationale |
