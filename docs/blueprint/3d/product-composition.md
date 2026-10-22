# Product Composition

Typed, reusable 3D products with connection ports, joined into an editable assembly: a
heating system of boiler, pump and radiators, or a shelf of uprights and boards. One engine,
no domain inside it. Pattern record: `product-connection-engine`.

## Contents

- [Why this shape](#why-this-shape) - the layers kept apart
- [Vocabulary](#vocabulary) - the names, and the ones avoided
- [Document and frames](#document-and-frames) - schema, port frames, IFC mapping
- [Invariants](#invariants) - what holds, and which test holds it
- [Operations and diagnostics](#operations-and-diagnostics) - pure edits, findings as data
- [Rendering and editing](#rendering-and-editing) - the Threlte layer
- [Plausibility, not certification](#plausibility-not-certification) - the safety line
- [Honest scope](#honest-scope) - what it does not do
- [Routing: evaluated, not built](#routing-evaluated-not-built) - when auto-routing earns its place
- [Seams outside the core](#seams-outside-the-core) - storage, IFC, telemetry, simulation
- [Proof](#proof) - the tests and pages behind the record
- [Emulating it](#emulating-it) - six steps, core first

## Why this shape

A configurator that draws products and lets the user join them tends to grow one tangled
component: meshes know about pipes, pipes know about thread sizes, and saving means
serialising the scene graph. This pattern keeps seven things apart, so each can change alone:

| Layer | Lives in | Knows nothing about |
|---|---|---|
| Definition — a catalogue entry: geometry, ports, internal passages | the document | where it is placed |
| Occurrence — one placed use of a definition | the document | the other products |
| Port — a typed connection point with a frame | the definition | what it is joined to |
| Coupling — *which* two ports are joined, mated or by a conduit | the document | the geometry between them |
| Conduit — *where* the pipe or cable runs (waypoints) | the document | why the ports are compatible |
| Rules — which ports may join | a `PortStandardRegistry` the caller supplies | heating, shelving, any domain |
| Rendering — meshes, markers, tubes, gizmo | `$lib/components/3d/composition/` | the rules |

Topology is not geometry: IFC 4.3 makes the same split between `IfcRelConnectsPorts` and the
element that realises it. The core (`$lib/product-composition/`) imports no Svelte, `$app`,
DOM or WebGL object, so an import, an AI tool or a server write can validate a document
exactly as the editor does.

## Vocabulary

`ProductComposition`, `ProductDefinition`, `ProductOccurrence`, `ProductPort`,
`PortStandard` / `PortStandardRegistry`, `Coupling` (`mated` | `conduit`), `Conduit`,
`passages`, `exposedPorts`, `PortNetwork`, `CompositionDiagnostic`. Each term, and the words
rejected for it, is a row in [`docs/naming.md`](../../naming.md).

## Document and frames

Schema: `src/lib/schemas/product-composition.ts` (strict Valibot objects).

```
ProductComposition { format: 1, id, label?, definitions, occurrences, couplings, conduits }
ProductDefinition  { id, label, body, metadata? }
  body: { kind: 'geometry', geometry, ports, passages? }
      | { kind: 'composition', occurrences, couplings, conduits, exposedPorts }
ProductPort        { id, label, standard, direction, gender, frame, capacity?, parameters? }
PortStandard       { id, family, label, genders, directions, clocking, matchParameters }
Coupling           { id, a, b, mode }        // a and b unordered
Conduit            { id, coupling, waypoints } // interior points only
```

- **The document is self-contained.** It carries every definition it uses. The registry of
  port standards is supplied by the caller. "Versioned" means `format`; versioning
  definitions belongs to a storage adapter.
- **Port frame.** +Z points out of the product, +Y is the clocking reference. A mate is a
  half turn about +Y: the two +Z axes face each other and the +Y axes line up.
- **IFC 4.3 mapping.** An `IfcDistributionPort` Axis points out for a SOURCE port and in for
  a SINK, and rigidly joined ports carry equal frames. Ours always points out (as SolidWorks
  Routing and Onshape mate connectors do): IFC Axis = our +Z for a source, −Z for a sink.
- **Semantics.** `direction` is the nominal design direction; actual flow is never
  computed. `neutral` gender is genderless (flanges, hermaphroditic connectors). Matching is
  equality on `matchParameters` only — keying such as an IEC 60309 clock position is a match
  parameter; ratings stay informational.
- **Determinism.** Every number is quantised to 1e-9 before it enters the document, and a
  quaternion's sign is fixed *after* quantising, so a half turn always serialises the same
  way. `stringifyComposition` sorts keyed collections and passages: the same edits give the
  same bytes.

## Invariants

| # | Invariant | Held by |
|---|---|---|
| 1 | The core is framework-free and renderer-free: only its schema, Valibot and Three.js math classes | the boundary gate in `compose.test.ts` |
| 2 | Pure and deterministic: same operations → byte-identical document, ±π included | `frame.test.ts`, `serialize.test.ts` |
| 3 | Couplings are well-formed: no self-coupling, no duplicate pair, capacity respected (a mate is exclusive), exposed ports never share an inner port | `validate.test.ts`, `operations.test.ts` |
| 4 | Compatibility comes from registry data only; the core names no domain | `standards.test.ts`; the neutrality gate in `compose.test.ts` |
| 5 | Mates hold within 1e-6: a connect snaps the moving side's whole cluster, a move re-derives the cluster along a spanning tree (no drift), consistent rings are allowed | `operations.test.ts`, `frame.test.ts` |
| 6 | Conduit ends always derive from the live port frames | `conduit.test.ts` |
| 7 | Removing an occurrence removes its couplings and their conduits | `operations.test.ts` |
| 8 | Findings are data, never throws; parse is fail-closed | `validate.test.ts`, `serialize.test.ts` |

Nested bodies are read-only from the outer level: no operation edits inside a definition.
Resolution and networks work on the flattened graph, so passages through a subassembly count.

## Operations and diagnostics

Every operation in `operations.ts` takes a composition and returns
`OperationResult { composition, diagnostics }`. A refused operation returns its input
unchanged with the reasons. Ids come from the caller or `nextId(prefix, existing)` — no
`Math.random`, no `Date`.

| Operation | Notes |
|---|---|
| `addOccurrence`, `removeOccurrence` | add copies a missing definition (and its nested ones) from a catalogue; remove cascades |
| `moveOccurrence`, `rotateOccurrence` | the mated cluster follows |
| `connect`, `disconnect` | connect runs the same checks validation does, for that one coupling |
| `setConduitWaypoints`, `insertWaypoint`, `removeWaypoint` | refused on a mated coupling |

`validateComposition` returns findings sorted by `(code, subject)`. Severity is fixed per
code (`diagnostics.ts`):

| Group | Codes | Severity | Raised by |
|---|---|---|---|
| definition | `definition.missing`, `composition.recursive` | error | validation |
| coupling | `coupling.unresolved`, `coupling.self`, `coupling.duplicate` | error | validation |
| port | `port.incompatible` (with its mismatch list), `port.capacity` | error | validation |
| port | `port.open` | info | validation |
| mate | `mate.misaligned` | error | validation |
| conduit | `conduit.unresolved`, `conduit.mode`, `conduit.duplicate` | error | validation |
| passage | `passage.unresolved`, `passage.self` | error | validation |
| exposed port | `exposed-port.unresolved`, `exposed-port.shared` | error | validation |
| operation | `id.duplicate`, `occurrence.unresolved`, `waypoint.unresolved` | error | refused operation only |

## Rendering and editing

`$lib/components/3d/composition/` reads only the core's resolved output:

- `CompositionCanvas` — `<svelte:boundary>` fallback around an on-demand `<Canvas>`, exposed
  as `role="img"` with a label that points to the keyboard way.
- `CompositionScene` — products, port markers (a larger invisible hit proxy for touch),
  conduit tubes (a `CurvePath` of straight runs with a quadratic fillet per corner, the old
  geometry disposed on rebuild), waypoint handles, and a translate-only `TransformControls`.
- `CompositionEditor` (`composition-editor.svelte.ts`) — `$state.raw` document, selection,
  an undo stack of snapshots (100, no redo), drag gestures that commit one undo step, dry-run
  coupling options, JSON import and export.

Two things the installed Threlte does not do for you: `@threlte/extras` 9.7.1's
`TransformControls` does not pause `CameraControls`, so the scene
toggles `controls.enabled` on drag start and end; and on-demand rendering needs an explicit
`invalidate()` whenever the document, selection or theme changes.

Colours are tokens: product tones map to theme tokens, port families to `--chart-N` by
their sorted position, which keeps the renderer as domain-free as the core. Physical tones
(`enamel`, `copper`, `brass`, `chrome`, `steel`, `glass`, `rubber`) map to the `--scene-*`
tokens, which keep their colour in every theme.

Surfaces are roles too. A primitive's optional `finish` (`matte`, `satin`, `gloss`, `metal`,
`brushed`) resolves in `surface-finish.ts` to physically based material parameters and
procedural grey maps (tileable value noise in `DataTexture`s: no download, no DOM, same pixels
every time); a box may round its edges (`radius`), and `torus` joins box, cylinder and sphere.
`primitive-geometry.ts` shares one geometry per distinct shape across occurrences.

Light and setting are the renderer's, never the document's: a generated studio environment
(`RoomEnvironment` through PMREM), a shadow-casting key light aimed at the composition,
Khronos PBR Neutral tone mapping. A caller may pass a `RoomLayout` — floor, back wall, corner,
windows, plaster and tile, a night palette in the dark theme — so wall-hung products read as
hung; with walls, the camera stays in front of them. `conduitSurfaces` draws a port family's
conduits as a physical run (copper pipe, a slim cable) and keeps the family colour on the
fittings at each end.

Everything the canvas does has a keyboard path in the showcase's inspector: a products list,
each product's ports, a picker of compatible partners, nudge and turn buttons, a waypoint
list. A status region announces each success and refusal.

## Plausibility, not certification

Every verdict means "the declared data fits": thread sizes agree, a mate lines up, a port is
not over-used. Nothing sizes a pipe, rates a cable, checks a pressure or approves an
installation. The showcase keeps a warning banner on screen that says so, and no copy,
diagnostic or record may claim engineering or electrical validity. This rule is held by
review, not by a test.

## Honest scope

- No constraint solver: mates and port rules only. The editor rotates in steps.
- Ratings (`capacity` aside) are informational; there are no range checks.
- No collision detection between products or conduits.

## Routing: evaluated, not built

Conduits are routed by hand: interior waypoints between two port stubs (`CONDUIT_STUB`,
0.1 m along each port's +Z). Auto-routing was evaluated and left out of the core. The
baseline when it is needed is bend-penalised A* on a voxel grid around the products, run as
a separate operation that writes waypoints. Build it when a document has obstacles that
matter, more than about ten conduits, or a catalogue of fittings to route through.

## Seams outside the core

Each is a caller of the core, not a part of it:

- **Storage** — persisting documents and versioning definitions.
- **IFC / BIM** — import and export through the frame mapping above.
- **Telemetry** — live values bound to occurrences or ports by id.
- **Simulation and sizing** — flows, pressures, loads; engineering tools own these.
- **Auto-routing** — see above.

## Proof

| Surface | What it shows |
|---|---|
| `src/lib/product-composition/*.test.ts` (8 files) | frames, standards, serialisation, resolution, networks, validation, operations, conduits |
| `src/lib/showcases/3d/compose/compose.test.ts` | both fixtures valid; the core names no domain and imports no framework; a six-step scenario replayed on the core |
| `src/lib/components/3d/composition/{conduit-tube,composition-editor.svelte}.test.ts` | tube geometry; undo, gestures, import |
| `/showcases/3d/compose` | heating (subassembly, conduits, open ports) and shelving (a ring of mates, GLB sofas) on one engine |
| `tests/browser/compose.spec.ts` | the scenario by keyboard and a gizmo drag, in Chromium (`bun run test:browser`, outside `validate`) |

## Emulating it

1. Copy the schema and `frame.ts` first; agree the port frame convention before any geometry.
2. Define your `PortStandard`s as data — never as `if (thread)` in the core.
3. Port `serialize.ts` and its canonical sort, then the operations with `OperationResult`.
4. Add `validate.ts` and the domain-neutrality gate with your own domain's words.
5. Write the scenario test on the core before any UI.
6. Add rendering last, reading only resolved output; give every canvas action a keyboard path.
