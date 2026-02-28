# Testing

Test infrastructure blueprints for the Velociraptor project. Covers the two-tool strategy (Vitest 4.x + Claude Chrome extension), AI agent testing loops, database isolation with PGlite, and Claude Code hooks.

## Files

| File | Main Topics |
|------|-------------|
| **[ai-testing-infrastructure.md](./ai-testing-infrastructure.md)** | • Two-tool strategy: Vitest 4.x (automated) + Claude Chrome extension (browser/E2E)<br>• Why Vitest over Bun test (confirmed: Bun issues #5541, #10712, #15032 still open)<br>• Why `vi.mock` over dependency injection for DB swap<br>• Co-located test directory structure<br>• PGlite database isolation: WASM Postgres in-process, `migrate` from `drizzle-orm/pglite/migrator`<br>• Why not `pushSchema`: undocumented API, interactive prompt bug, `pgSchema` failures<br>• Incremental schema loading: `jobs` → `auth+notifications` → `auth+ai` → `auth+rag`<br>• Out-of-schema DDL: RAG tsvector/HNSW/GIN indexes need separate SQL<br>• Neo4j mocking: `cypher()` mock for unit/integration tests<br>• Test data factories: `makeUser()`, `makeNotification()` patterns<br>• Setup file: `$env` mocks, `$app/environment` mock, scheduler sentinels, `.env.test`<br>• Claude Code hooks: PostToolUse (Biome lint) and Stop (quality gate)<br>• Machine-readable output: console, JSON, JUnit XML<br>• Five phases: Foundation → Pure logic tests → DB tests → Stop hook → AGENTS.md + CI<br>• Phase 4 priority: data access → orchestration → auth/security → load functions → components → state machines<br>• Rejected approaches table with evidence (pushSchema, DI, Testcontainers, pg-mem, Playwright, Neon Testing)<br>• AGENTS.md template with test commands, patterns, and boundaries |
