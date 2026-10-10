---
title: "Reproducible artifact build (regenerate-and-diff, or manifest + digest)"
description: "Committed generated artifacts are proven current by the gate: regenerate-and-diff (missing and orphan outputs included) when the generator can run there, an…"
category: "Derivation & Provenance"
---

# Reproducible artifact build (regenerate-and-diff, or manifest + digest)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Derivation & Provenance · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — the check is cheap; the failure mode is a generator added without one

Committed generated artifacts are proven current by the gate: regenerate-and-diff (missing and orphan outputs included) when the generator can run there, an SLSA-shaped manifest of input/output digests plus a pinned toolchain when it cannot — each artifact labelled bit-for-bit or input-addressed.

**When to use:** Use for any generated output committed to the repo or shipped as a file: generated docs and indexes, snapshots, compiled binaries, vendored builds.

## Avoid when

- The output is rebuilt on every deploy and never committed — the deploy itself is the regeneration
- The generator is nondeterministic and its output cannot be made stable — record its inputs (input-addressed) instead of diffing bytes

## Alternatives

- **Signed provenance (SLSA L2+, in-toto)** — prefer when third parties consume and must independently verify the artifact
- **Byte-diffing a pinned-container rebuild in the gate** — prefer when the toolchain can run in CI cheaply — stronger than a manifest, which only proves the files match what was hashed

## Docs

- [docs/blueprint/integrity/derivation.md#reproducible-artifact-build](/docs/blueprint/integrity/derivation) — Which proof each case gets, and bit-for-bit vs input-addressed ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/derivation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/derivation.md))

## Code

- `scripts/patterns/build-derived.ts` — Regenerate-and-diff with orphan detection ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/patterns/build-derived.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/patterns/build-derived.ts))
- `scripts/mcp/build-public-excerpts.ts` — Single-file byte-compared snapshot ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/mcp/build-public-excerpts.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/mcp/build-public-excerpts.ts))
- `scripts/wasm/build.sh` — Pinned-digest container build that writes the manifest ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/wasm/build.sh) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/wasm/build.sh))
- `src/lib/wasm/kernel/build-manifest.json` — Image digest, bindgen version, input and output sha256 ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel/build-manifest.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel/build-manifest.json))

## Tests

- `src/lib/wasm/kernel-manifest.test.ts` — Recomputes every digest; states its own limits ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/wasm/kernel-manifest.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/wasm/kernel-manifest.test.ts))
- `src/lib/server/perf/snapshot.gate.test.ts` — Refuses a snapshot without gitSha or a production build ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/snapshot.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/snapshot.gate.test.ts))
- `src/lib/server/mcp/patterns/excerpts.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/patterns/excerpts.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/patterns/excerpts.test.ts))

## Invariants

- A committed artifact is checked by the gate; a generator with no check is an unbound mirror.
- --check fails on missing and orphaned outputs, not only on changed bytes.
- Generators read neither the clock nor the network and iterate in a declared order.
- A manifest pins its toolchain by digest, not by tag, and carries no wall-clock time.
- Each artifact is labelled with the proof it actually has — bit-for-bit, manifest-matched, or input-addressed.

## Emulation notes

- Choose the proof by asking whether the gate can run the generator; only fall back to a manifest when it cannot, because a manifest proves "files match what was hashed", not "a rebuild would match".
- Write the manifest last, after every output is in place, so an interrupted build cannot leave a manifest describing outputs that never landed.
- Say the limits in the check's own header, as kernel-manifest.test.ts does — the next reader will otherwise assume it proves semantics.

---

_Machine-readable record: `reproducible-artifact-build` in `pattern-library/registry.json`._
