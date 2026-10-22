---
title: "Product composition engine (typed ports, couplings, conduits)"
description: "Reusable 3D products with typed connection ports join into an editable assembly: a framework-free core keeps definitions, occurrences, ports, couplings…"
category: "3D"
---

# Product composition engine (typed ports, couplings, conduits)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** 3D · **Tier:** deep · **Maturity:** proven (verified 2026-10-20 @ 42d5b7c-dirty) · **Risk:** low — frontend only; plausibility checks, not engineering certification

Reusable 3D products with typed connection ports join into an editable assembly: a framework-free core keeps definitions, occurrences, ports, couplings, conduit routes and port rules apart, validates and edits them deterministically, and a thin Threlte layer renders and edits the result.

**When to use:** Use when users assemble products that connect through defined points — pipes and fittings, cables and devices, modular furniture — and the assembly must be saved, validated against port rules and edited by pointer and keyboard.

## Avoid when

- One product on its own, viewed or customised — the model viewer and customizer patterns are enough
- The result must be engineering- or electrically-validated (sizing, pressure, load, code compliance) — this engine checks plausibility of declared data, never physics
- Parts must satisfy geometric constraints beyond face-to-face mates (distances, angles, parametric CAD) — there is no constraint solver
- A BIM model is the source of truth — edit it in a BIM toolkit and treat this as a viewer at most

## Alternatives

- **An IFC/BIM toolkit (IfcOpenShell, web-ifc) working on the IFC model directly** — prefer when the authoritative data is an IFC model that other trades also edit
- **CAD routing (SolidWorks Routing, Onshape mate connectors)** — prefer when routes need fittings catalogues, bend radii, sizing or certified drawings

## Docs

- [docs/blueprint/3d/product-composition.md](/docs/blueprint/3d/product-composition) — The full pattern: layer split, frames + IFC mapping, invariants, operations, diagnostics, scope and emulation steps ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/product-composition.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/product-composition.md))

## Code

- `src/lib/product-composition/` — Framework-free core: frames, standards, serialisation, resolution, networks, validation, operations, conduits ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/product-composition) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/product-composition))
- `src/lib/product-composition/README.md` — The core's boundaries and one responsibility per file ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/README.md))
- `src/lib/schemas/product-composition.ts` — The persisted document (Valibot), with the port-frame convention ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/product-composition.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/product-composition.ts))
- `src/lib/components/3d/composition/` — Threlte rendering and the CompositionEditor (undo, gestures, import/export) ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/3d/composition) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/3d/composition))
- `src/lib/showcases/3d/compose/` — Heating and shelving fixtures on the same engine ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/showcases/3d/compose) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/showcases/3d/compose))

## Tests

- `src/lib/product-composition/frame.test.ts` — Canonical frames: quantise then fix the quaternion sign, so a half turn serialises one way; mates and the free-clocking snap ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/frame.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/frame.test.ts))
- `src/lib/product-composition/standards.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/standards.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/standards.test.ts))
- `src/lib/product-composition/serialize.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/serialize.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/serialize.test.ts))
- `src/lib/product-composition/resolve.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/resolve.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/resolve.test.ts))
- `src/lib/product-composition/network.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/network.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/network.test.ts))
- `src/lib/product-composition/validate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/validate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/validate.test.ts))
- `src/lib/product-composition/operations.test.ts` — Connect/refuse rules, a mated snap moving the whole cluster, drift-free moves, a consistent ring of mates, the remove cascade ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/operations.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/operations.test.ts))
- `src/lib/product-composition/conduit.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/product-composition/conduit.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/product-composition/conduit.test.ts))
- `src/lib/showcases/3d/compose/compose.test.ts` — Both fixtures valid on the unchanged core; the domain-neutrality and boundary gates; the six-step scenario on the core alone ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/showcases/3d/compose/compose.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/showcases/3d/compose/compose.test.ts))
- `src/lib/components/3d/composition/composition-editor.svelte.test.ts` — Editor state: apply/refuse, undo, one undo step per drag gesture, import ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/3d/composition/composition-editor.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/3d/composition/composition-editor.svelte.test.ts))
- `src/lib/components/3d/composition/conduit-tube.test.ts` — Filleted tube path through the conduit polyline ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/3d/composition/conduit-tube.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/3d/composition/conduit-tube.test.ts))
- `tests/browser/compose.spec.ts` — Playwright: the scenario by keyboard plus a gizmo drag, asserted through Export JSON — bun run test:browser, outside validate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/tests/browser/compose.spec.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/tests/browser/compose.spec.ts))

## Proof

- [`/showcases/3d/compose`](/showcases/3d/compose)

## Invariants

- The core imports no framework, DOM or renderer — only its schema, Valibot and Three.js math — so any caller validates a document exactly as the editor does.
- Compatibility comes from PortStandard data the caller supplies; the core names no domain (a gate fails on heating or shelving words in its code).
- Operations are pure and deterministic: they return { composition, diagnostics }, never throw, refuse by returning the input unchanged, and the same edits give byte-identical documents (numbers quantised, quaternion sign fixed after quantising).
- A coupling says which ports are joined; a conduit says where the pipe or cable runs. Conduit ends always derive from the live port frames.
- Mates hold: a mated connect snaps the moving side's whole cluster, a move re-derives the cluster along a spanning tree with no drift, and a ring is accepted only if its mates already hold.
- Removing a product removes its couplings and their conduits; no coupling joins one product to itself or the same pair twice; a mate uses its port exclusively.
- Findings mean plausibility of declared data only — never certification — and the UI says so on screen.

## Emulation notes

- Fix the port frame convention first (+Z out, +Y clocking, mate = half turn about +Y) and write the IFC mapping down before any geometry.
- Express every compatibility rule as PortStandard data; keep a grep gate for your own domain's words over the core.
- Write the scenario test on the pure core before any UI; the browser spec then replays the same steps.
- Route conduits by hand with waypoints; add auto-routing (bend-penalised A* on a voxel grid) only for obstacles, many conduits or fitting catalogues.
- Give every canvas action a keyboard path (product list, port list, partner picker, nudge buttons) and pause camera controls during gizmo drags yourself if your Threlte version does not.

## Depends on

- [Threlte integration (SSR-off, code-split model registry)](/docs/pattern-library/3d-threlte-integration)

---

_Machine-readable record: `product-connection-engine` in `pattern-library/registry.json`._
