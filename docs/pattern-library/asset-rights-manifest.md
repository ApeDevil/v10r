---
title: "Asset rights manifest (owned rights record + gate over shipped files)"
description: "Every third-party file the app ships carries one AssetRights record (author, SPDX license, source) owned by the module that uses it, derived into every…"
category: "Truth & Evidence"
---

# Asset rights manifest (owned rights record + gate over shipped files)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Truth & Evidence · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — the failure mode is an un-credited asset, which the directory comparison turns into a red gate

Every third-party file the app ships carries one AssetRights record (author, SPDX license, source) owned by the module that uses it, derived into every surface that credits it, and gated against the files actually present — metadata presence and shape, never a legal conclusion.

**When to use:** Use when the app ships third-party media — models, photos, fonts, sounds — whose licenses require attribution or restrict use.

## Avoid when

- Every asset is first-party — there is no author to credit and no license to record
- The only third-party code is npm dependencies — their license metadata travels in the package; check it there

## Alternatives

- **REUSE.toml or .license sidecar files** — prefer when the assets are repository files consumed by tools rather than rendered by the app
- **A database rights table filled at upload** — prefer when users upload the assets at runtime, so no module can own the record at build time

## Docs

- [docs/blueprint/integrity/truth.md#asset-rights-manifest](/docs/blueprint/integrity/truth) — The owned record, the gate, and what it deliberately does not prove ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/truth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/truth.md))

## Code

- `src/lib/credits/asset-rights.ts` — AssetRights, requiresAttribution, licenseLabel, creditLine ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/credits/asset-rights.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/credits/asset-rights.ts))
- `src/lib/3d/models.ts` — Owner: Model3D.rights ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/3d/models.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/3d/models.ts))
- `src/lib/3d/parts.ts` — Owner: PartPhoto.rights ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/3d/parts.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/3d/parts.ts))
- `src/lib/credits/registry.ts` — assetCredits derived from the owners ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/credits/registry.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/credits/registry.ts))

## Tests

- `src/lib/credits/registry.gate.test.ts` — Every file under the asset dirs credited once; SPDX shape; attribution fields ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/credits/registry.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/credits/registry.gate.test.ts))

## Proof

- [`/credits`](/credits) (app route, no showcase) — Models & Photos section, rendered from assetCredits

## Invariants

- Every shipped third-party file has exactly one rights record, owned by the module that uses it.
- No second attribution copy lives beside the files — the record is derived into every surface.
- A license that requires attribution is rendered wherever the asset is credited.
- Rights metadata is never presented as a legal conclusion.

## Emulation notes

- Gate against the directory, not against the list: listing the files on disk and comparing is what catches the asset added without a record.
- Keep a LicenseRef- id for public-domain marks and proprietary EULAs rather than inventing a pseudo-SPDX string — the gate can then stay a syntax check.
- Say what the check does not prove in the doc and the test header; an inventory that looks like legal review is worse than none.

## Depends on

- [Source-of-truth gate (one owner, bound copies)](/docs/pattern-library/source-of-truth-gate)

---

_Machine-readable record: `asset-rights-manifest` in `pattern-library/registry.json`._
