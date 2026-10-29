# `#lib/asset-production/index.ts`

The engine that turns one structured request into a checked 3D asset: a generator builds a
mesh from bounded parameters, the inspector checks it, the encoder writes a byte-stable GLB and
reads it back. The persisted request is `#lib/schemas/asset-production.ts`; the job around a
run — environments, report, store, MCP tools — is `#lib/server/asset-production/`.

It sits below the server and the component layer because more than one place runs it: the
server produces assets, and the showcase runs the same generator's `check` and `estimate` in
the browser before it sends a request. Nothing here imports Svelte, `$app`, the DOM or a Node
API; Three.js is used for `Vector3` only.

Three boundaries hold the design together:

- **Requests, not code.** A caller names a generator and gives bounded parameters. There is no
  path from a request to a script, a file or an engine flag.
- **The mesh is the seam.** Generators produce a `GeneratedMesh` (primitives, closed shells, a
  declared envelope); inspection and encoding read only that, so a new generator or a different
  engine behind the same seam changes nothing downstream.
- **Findings are data.** Every refusal or defect is an `AssetDiagnostic` with a fixed severity;
  the engine never throws for one.

| File | Responsibility |
|---|---|
| `engine.ts` | `AssetProductionEngine`: stages, the budget checked twice, cancellation and deadline checkpoints |
| `generators/` | The generator contract and registry; `structural-ring.ts` is the demonstration object |
| `mesh.ts` | The mesh intermediate and its builder: capped tubes and boxes as closed shells |
| `inspect.ts` | Counts, bounds, area, volume; closed and outward shells, finite values, the envelope |
| `glb.ts` | DOM-free, byte-stable GLB writer and the read-back gate |
| `diagnostics.ts` | Finding codes and their fixed severity |
| `report.ts` | The report's shape (types only), so a browser reads it without server imports |

The pattern as a whole — engine comparison, invariants, gates, measurements, the managed-service
path — is `docs/blueprint/3d/asset-production.md`.
