# Data Blueprints

Implementation designs for data layer patterns.

| File | Topics |
|------|--------|
| [drizzle-workflow.md](./drizzle-workflow.md) | Drizzle push-only workflow, schema-first development |
| [neon-branch-refresh.md](./neon-branch-refresh.md) | Reset dev branch from prod (`/admin/db`, live-verified), two-plane access (data vs control), manual + scheduled refresh + monitor, `neon/` + `dbops/` domains, lazy-advance-on-poll executor, `dbops.run` ledger, env setup, operating notes (destructive, confirmation dialog), prod→dev-only / GDPR constraints |
