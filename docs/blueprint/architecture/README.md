# Architecture

Cross-cutting structural decisions — patterns that span multiple features and client types.

## Files

| File | Main Topics |
|------|-------------|
| **[multi-client-core.md](./multi-client-core.md)** | • How human UI, AI agents, REST API, and background jobs share the same domain logic<br>• The four invariants (no framework imports in domain modules, date serialization in route layer, etc.)<br>• AI tool definition pattern with `createTools(userId)` factory<br>• Auth per client type, error handling across surfaces<br>• Cross-domain boundary rules, extraction rules, what we chose not to do |
