# Key ring

How v10r keeps credentials at rest — AI provider API keys and name-check vendor secrets —
so that the key sealing them can be rotated without losing a single one.

## Encryption key ring

**Problem.** A secret encrypted under one deployment key is only as durable as that key. An
envelope that does not say which key sealed it ties every stored secret to the key in the
environment at read time: replace the key and every envelope becomes unreadable, so the only
"rotation" is re-entering every credential by hand. Teams therefore never rotate, and a
leaked key stays valid forever.

**Method.** Three pieces, each in one place:

| Piece | Where | What it does |
|---|---|---|
| Envelope names its key | `security/aes-gcm.ts` | `v2:<kid>:base64(nonce):base64(ciphertext‖tag)`, AES-256-GCM, 12-byte random nonce. `kid` = first 8 hex chars of SHA-256 over the raw key — derived, so no operator names a key and none can be mislabelled |
| A ring, not a key | `security/encryption-key.ts` | `ENCRYPTION_KEY` seals; `ENCRYPTION_KEY_PREVIOUS` (comma-separated) only opens. Every key is validated at boot (placeholders, duplicates). The one environment read; the bare-Bun scripts build the same ring with `tryParseKeyRing` |
| Re-seal sweep | `jobs/encryption-reseal.ts` | Daily: opens every envelope, re-seals the stale ones under the current key, and swaps each in with a compare-and-swap on the envelope itself |

Opening picks the key by `kid`. An envelope written before the ring has no `kid`; it is
opened by trying each key of the ring and counts as stale. `openSecret` answers
`none` · `ready` · `undecryptable` plus `stale`, never throws, so the admin pages can show a
key that left the ring too early instead of failing.

**Why compare-and-swap on the envelope.** The re-seal changes how a secret is sealed, not the
secret. Bumping the row's `version` would make an administrator's open form conflict for no
reason; not checking anything would let the sweep overwrite a key the administrator just
saved. `UPDATE … SET ciphertext = $new WHERE id = $id AND ciphertext = $old` does neither: a
save that lands first makes the swap match nothing, and that row is already on the current key.

**Invariants.**
- Every new envelope is sealed under `ENCRYPTION_KEY` and names it.
- No key of the ring is ever stored in the database or sent to a client.
- The sweep never changes a secret's plaintext, `version` or `updatedAt`.
- An envelope no key opens is reported (`undecryptable`, a failed sweep run), never
  overwritten or deleted.

**Do not use** a ring as a substitute for a KMS when the threat is a compromised host: the
keys still live in the deployment's environment. Use a KMS or envelope encryption with a
key-encryption key when keys must be unreachable from the application process.

## Rotation

1. Generate a key: `openssl rand -hex 32`.
2. In the deployment's secrets, set `ENCRYPTION_KEY` to the new key and add the old one to
   `ENCRYPTION_KEY_PREVIOUS`. Redeploy.
3. Run `encryption-reseal` from `/admin/jobs` (or wait for the daily sweep). It reports how
   many envelopes it moved; a run that cannot open some envelope fails and says how many.
4. Once the new deployment serves every request, run it once more: a function instance still
   running the old configuration can seal a save under the old key during the rollout. When a
   run succeeds and reports `0` re-sealed, remove the old key from `ENCRYPTION_KEY_PREVIOUS`
   and redeploy.

A key that leaked is rotated the same way; the old key stops opening anything at step 4.
