# `$lib/product-composition`

Products that connect, independent of how they are drawn: a document of **definitions**
(reusable catalogue entries with geometry and typed **ports**), **occurrences** (placed uses
of a definition), **couplings** (logical edges between two ports) and **conduits** (the pipe
or cable path that physically realises a coupling). The persisted shape is
`$lib/schemas/product-composition.ts`; this directory is the arithmetic and the rules over it.

It sits below the component layer, like `$lib/desk/`, because more than one place needs the
same answers: the Threlte editor renders and edits a composition, and anything that accepts a
composition file — an import, an MCP or AI tool, a server write — must validate it exactly as
the editor would. Nothing here imports Svelte, `$app`, the DOM or a WebGL object; Three.js is
used for its math classes only.

Three boundaries hold the design together:

- **Topology is not geometry.** A coupling says *which* ports are joined; a conduit says
  *where the pipe runs*. Either can change without the other (the IFC 4.3 split between
  `IfcRelConnectsPorts` and its realizing element).
- **The core is domain-free.** What a port *is* — a thread size, a bus, a peg — is a
  `PortStandard` the caller supplies. The core only knows the shape of a rule.
- **Plausibility, not certification.** Every verdict is "the declared data fits". Nothing
  here sizes, rates or approves an installation, and no surface may present it as doing so.

| File | Responsibility |
|---|---|
| `frame.ts` | Rigid frames: compose, invert, mate a port face to face, test a mate |
| `standards.ts` | Port-standard registry and the compatibility rules between two ports |
| `serialize.ts` | Fail-closed parse; canonical, byte-stable stringify |
| `resolve.ts` | Flatten nested definitions: leaf products and ports in world space, `PortRef` → leaf port key |
| `network.ts` | Port networks through couplings and passages; how each port is used |
| `validate.ts` | Whole-document validation → sorted `CompositionDiagnostic`s |
| `operations.ts` | Pure lifecycle: add / remove / move / rotate, connect / disconnect, waypoint edits |
| `conduit.ts` | A conduit coupling's path: port stubs + waypoints → points, length, bends |
| `diagnostics.ts` | Diagnostic codes, their fixed severity, and the stable sort |

The heating and shelving fixtures that exercise it — and the gate proving it names no domain —
live with their showcase in `$lib/showcases/3d/compose/`. The pattern as a whole — invariants,
scope, emulation steps — is `docs/blueprint/3d/product-composition.md`.
