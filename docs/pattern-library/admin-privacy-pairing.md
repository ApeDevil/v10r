---
title: "Cross-device debug pairing (QR + HMAC cookie)"
description: "A short-lived, single-use pairing code and QR flow that attributes a phone's anonymous pageviews to an admin's identity via an HMAC-signed cookie, without…"
category: "Admin & Privacy"
---

# Cross-device debug pairing (QR + HMAC cookie)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — HMAC cookie and code claiming must resist forgery/replay

A short-lived, single-use pairing code and QR flow that attributes a phone's anonymous pageviews to an admin's identity via an HMAC-signed cookie, without logging the phone in.

**When to use:** Use when an admin needs to test the live site on a second device and see its activity attributed on the dashboard.

## Docs

- [docs/blueprint/admin/pairing.md](/docs/blueprint/admin/pairing) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/admin/pairing.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/admin/pairing.md))

## Code

- `src/lib/server/pairing/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/pairing) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/pairing))

## Proof

- [`/pair/[code]`](/pair/[code]) (app route, no showcase)

---

_Machine-readable record: `admin-privacy-pairing` in `mcp/patterns.registry.json`._
