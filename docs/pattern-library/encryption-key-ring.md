---
title: "Encryption key ring (envelopes name their key, rotation re-seals)"
description: "Stored credentials are AES-256-GCM envelopes that name the key sealing them (a derived key id), opened by a ring of current and previous keys, so rotating…"
category: "Admin & Privacy"
---

# Encryption key ring (envelopes name their key, rotation re-seals)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Admin & Privacy · **Tier:** deep · **Maturity:** proven (verified 2026-10-23 @ 95de612-dirty) · **Risk:** medium — dropping a previous key before the sweep ran makes the secrets it sealed undecryptable; the failed sweep and the admin pages' undecryptable status say so

Stored credentials are AES-256-GCM envelopes that name the key sealing them (a derived key id), opened by a ring of current and previous keys, so rotating ENCRYPTION_KEY is a ring change plus a re-seal sweep with a compare-and-swap on the envelope — never a mass re-entry of secrets.

**When to use:** Use when the app stores third-party credentials or other secrets encrypted under a deployment key that must be rotatable.

**Requires:** postgres, cron

## Avoid when

- The secrets can live in a managed KMS or secret store that does the envelope encryption and rotation for you
- Nothing is stored encrypted — the only secrets are environment variables the platform already manages

## Alternatives

- **KMS envelope encryption (a data key per secret wrapped by a KMS key)** — prefer when the key must be unreachable from the application process, or compliance requires audited key use
- **A database key-version column beside each ciphertext** — prefer when the envelope format cannot change, e.g. a third-party reader parses it

## Docs

- [docs/blueprint/security/key-ring.md#encryption-key-ring](/docs/blueprint/security/key-ring) — Envelope format, the ring, the re-seal sweep and its compare-and-swap ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/security/key-ring.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/security/key-ring.md))
- [docs/blueprint/security/key-ring.md#rotation](/docs/blueprint/security/key-ring) — The four-step operator runbook ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/security/key-ring.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/security/key-ring.md))

## Code

- `src/lib/server/security/aes-gcm.ts` — v2:<kid> envelope, parseKeyRing, openEnvelope (stale), resealEnvelope, openSecret ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/aes-gcm.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/aes-gcm.ts))
- `src/lib/server/security/encryption-key.ts` — The one ENCRYPTION_KEY / ENCRYPTION_KEY_PREVIOUS read ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/encryption-key.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/encryption-key.ts))
- `src/lib/server/security/envelope-reseal.ts` — The shared re-seal loop over owner-supplied rows ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/envelope-reseal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/envelope-reseal.ts))
- `src/lib/server/jobs/encryption-reseal.ts` — The daily sweep; fails loudly on an unreadable envelope ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/encryption-reseal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/encryption-reseal.ts))
- `src/lib/server/db/ai/provider-connections.ts` — replaceProviderKeyEnvelope: compare-and-swap on the envelope ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/ai/provider-connections.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/ai/provider-connections.ts))

## Tests

- `src/lib/server/security/aes-gcm.test.ts` — Legacy vector, kid routing, stale after rotation, unknown kid, tamper, ring parsing, re-seal loop ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/aes-gcm.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/aes-gcm.test.ts))
- `src/lib/server/db/name-check/source-connections.pglite.test.ts` — Envelope swap keeps version and updatedAt, and loses to a concurrent write ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/name-check/source-connections.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/name-check/source-connections.pglite.test.ts))

## Invariants

- Every new envelope is sealed under the current key and names it by a derived key id.
- No key of the ring is stored in the database or sent to a client.
- The re-seal sweep never changes a secret's plaintext, version or updatedAt, and swaps only the envelope it read.
- An envelope no key opens is reported as undecryptable, never overwritten or deleted.

## Emulation notes

- Derive the key id from the key (a truncated hash) instead of letting operators name keys — a mislabelled key is then impossible.
- Keep reading the pre-ring envelope format by trying every key, and count it as stale so the sweep migrates it.
- Make the sweep fail after re-sealing what it can when some envelope opens under no key: that failed run is the signal not to drop the previous key yet.

## Depends on

- [Jobs & scheduling (registry, runner, platform-owned cadence)](/docs/pattern-library/jobs-scheduler)

---

_Machine-readable record: `encryption-key-ring` in `pattern-library/registry.json`._
