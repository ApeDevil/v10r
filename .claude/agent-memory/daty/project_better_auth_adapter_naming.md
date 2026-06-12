---
name: better-auth-adapter-naming
description: drizzleAdapter resolves Better Auth model→table by EXPORTED CONST NAME (schema-object key), not the SQL pgTable name string; field keys match the same way — load-bearing for every plugin table (passkey, twoFactor, etc.)
metadata:
  type: project
---

When adding any Better Auth plugin table (passkey, twoFactor, organization, …) as a Drizzle schema:

**The drizzleAdapter resolves a model to a table by the EXPORTED CONST NAME (the key in the schema object), NOT by the SQL/physical table-name string.**

**Why:** `src/lib/server/db/index.ts` does `drizzle(pool, { schema: { ...schema, ...relations } })` → Drizzle stores this as `db._.fullSchema`, keyed by the spread's property names = the exported const identifiers. `src/lib/server/auth/index.ts` calls `drizzleAdapter(db, { provider: 'pg' })` with NO `schema` mapping option → for a model `X` it looks up `fullSchema[X]` by key. The string in `authSchema.table('two_factor', …)` is only used to emit DDL; it is never matched against.

**How to apply:**
- Export const MUST be camelCase, matching the Better Auth model id EXACTLY: `export const twoFactor`, `export const passkey`. This is the lookup key — non-negotiable.
- SQL physical name is free to choose (snake_case preferred): `authSchema.table('two_factor', …)`. Invisible to the adapter.
- Column FIELD KEYS match the same way: `credentialID`, `publicKey`, `backedUp` must be camelCase exactly as Better Auth names them; the SQL column string (`'credential_id'`) is yours.
- The schema-index re-export (`schema/auth/index.ts` → `export * from './passkey'`) is load-bearing for the ADAPTER too, not just `db:push`. A missing re-export = "model not found" at runtime, not just a silent push drop.

**File placement rule (settled):** a table goes in `_better-auth.ts` only if the Better Auth CLI regenerates it there. Plugin tables from a SEPARATE npm package (`@better-auth/passkey`) get their own file beside `grant.ts`. Plugin COLUMNS the CLI writes to an existing core table (admin `role`/`banned`; twoFactor `twoFactorEnabled`) go INTO `_better-auth.ts`. Tables app-authored, columns CLI-owned.

Related: [[user-data-inventory]] (privacy DTO must project out passkey publicKey/credentialID/counter/secret/backupCodes). The passwordless-2fa-gap (secy memory) means TOTP enable/disable is password-gated (#1279) — schema is ready before enrollment is solvable.
