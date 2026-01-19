# 3D Implementation Diagrams

ASCII art diagrams showing architecture, data flow, and component structure.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    VELOCIRAPTOR 3D                                   │
│                              Three.js + Threlte + SvelteKit                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   BROWSER   │     │   SVELTEKIT │     │  DATABASES  │     │   STORAGE   │
    │   (Client)  │     │   (Server)  │     │             │     │             │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │                   │
           │    ┌──────────────┴──────────────┐    │                   │
           │    │                             │    │                   │
           ▼    ▼                             ▼    ▼                   ▼
    ┌────────────────┐              ┌────────────────┐         ┌────────────┐
    │  Svelte 5     │              │   API Routes   │         │            │
    │  Components   │◄────────────►│  (+server.ts)  │◄───────►│ PostgreSQL │
    │               │   SSR/CSR    │                │  Drizzle │   (Neon)   │
    └───────┬───────┘              └───────┬────────┘         └────────────┘
            │                              │                         │
            │                              │                         │
    ┌───────▼───────┐              ┌───────▼────────┐         ┌─────▼──────┐
    │  Three.js    │              │   Validation   │         │   Neo4j    │
    │   Engine     │              │  (server/3d/)  │         │   (Aura)   │
    │              │              │                │         │ similarity │
    └───────┬───────┘              └───────┬────────┘         └────────────┘
            │                              │
            │                              │
    ┌───────▼───────┐              ┌───────▼────────┐         ┌────────────┐
    │    WebGL     │              │      R2        │◄───────►│ Cloudflare │
    │   Context    │              │   Storage      │  S3 API │     R2     │
    │              │              │                │         │    CDN     │
    └──────────────┘              └────────────────┘         └────────────┘
```

---

## File Structure

```
src/
├── lib/
│   ├── 3d/                                    ◄── ENGINE LAYER (No Svelte)
│   │   ├── index.ts                           ◄── Public API exports
│   │   ├── types.ts                           ◄── Scene3DContext, interfaces
│   │   ├── context.ts                         ◄── Typed context helpers
│   │   │   │
│   │   │   │   ┌────────────────────────────────────────────────────┐
│   │   │   │   │  const SCENE_KEY = Symbol('scene3d');              │
│   │   │   │   │  export function setSceneContext(...)              │
│   │   │   │   │  export function getSceneContext(): Scene3DContext │
│   │   │   │   └────────────────────────────────────────────────────┘
│   │   │   │
│   │   └── engine/
│   │       ├── scene.ts                       ◄── createScene(), dispose()
│   │       ├── loader.ts                      ◄── LRU cache, loadGLTF()
│   │       ├── dispose.ts                     ◄── disposeObject(), cleanup
│   │       └── privacy.ts                     ◄── blockDebugInfo()
│   │
│   ├── shared/
│   │   └── 3d/
│   │       └── types.ts                       ◄── Shared types (client+server)
│   │           │
│   │           │   ┌────────────────────────────────────────────┐
│   │           │   │  ComplexityLimits, DEFAULT_LIMITS          │
│   │           │   │  maxVertices: 500_000                      │
│   │           │   │  maxTriangles: 250_000                     │
│   │           │   │  maxAnimations: 50                         │
│   │           │   └────────────────────────────────────────────┘
│   │           │
│   ├── server/
│   │   ├── 3d/                                ◄── SERVER-ONLY VALIDATION
│   │   │   ├── validation.ts                  ◄── Magic bytes, chunk check
│   │   │   ├── limits.ts                      ◄── preValidateGLB()
│   │   │   ├── sanitize.ts                    ◄── XSS: sanitizeGLTFMetadata()
│   │   │   ├── uris.ts                        ◄── SSRF: validateGLTFURIs()
│   │   │   └── storage.ts                     ◄── getModelUrl() signed URLs
│   │   │
│   │   └── db/
│   │       ├── schema/
│   │       │   └── models3d.ts                ◄── PostgreSQL schema
│   │       ├── relations.ts                   ◄── models3dRelations
│   │       └── id.ts                          ◄── createId.model3d()
│   │
│   └── components/
│       └── 3d/                                ◄── SVELTE LAYER
│           ├── index.ts                       ◄── Re-exports
│           ├── Canvas.svelte                  ◄── Root wrapper
│           ├── Model.svelte                   ◄── GLTF loader component
│           └── controls/
│               ├── Orbit.svelte               ◄── OrbitControls
│               └── Keyboard.svelte            ◄── Accessibility controls
│
└── routes/
    ├── showcase/3d/
    │   ├── +layout.svelte                     ◄── Cache cleanup on nav
    │   ├── +page.svelte                       ◄── Gallery
    │   ├── +page.server.ts                    ◄── List user's models
    │   └── [model]/
    │       ├── +page.svelte                   ◄── Viewer
    │       └── +page.server.ts                ◄── Auth + ownership check
    │
    └── api/models/
        ├── upload/+server.ts                  ◄── POST: upload model
        └── [id]/+server.ts                    ◄── GET/DELETE: model ops
```

---

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              +page.svelte (Route)                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│    <Canvas>                                              setSceneContext()       │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │   onMount() ──► import('$lib/3d/engine/scene') ──► createScene()        │  │
│    │                                                         │                │  │
│    │                                          ┌──────────────┴──────────────┐ │  │
│    │                                          │     Scene3DContext          │ │  │
│    │                                          │  • scene: THREE.Scene       │ │  │
│    │                                          │  • camera: PerspectiveCamera│ │  │
│    │                                          │  • renderer: WebGLRenderer  │ │  │
│    │                                          │  • requestRender()          │ │  │
│    │                                          │  • dispose()                │ │  │
│    │                                          └─────────────────────────────┘ │  │
│    │                                                                          │  │
│    │   <canvas bind:this={canvas} tabindex="0">                              │  │
│    │       │                                                                  │  │
│    │       ├── <Model src={url}>              getSceneContext()              │  │
│    │       │   │                                     │                        │  │
│    │       │   │   $effect() ──► loadGLTF() ──► scene.add(model)            │  │
│    │       │   │                      │                                       │  │
│    │       │   │              ┌───────▼───────┐                              │  │
│    │       │   │              │   LRU Cache   │                              │  │
│    │       │   │              │  (10 models)  │                              │  │
│    │       │   │              │               │                              │  │
│    │       │   │              │  onEvict() ───┼──► disposeObject()           │  │
│    │       │   │              └───────────────┘                              │  │
│    │       │   │                                                              │  │
│    │       │   └── cleanup: scene.remove(model)                              │  │
│    │       │                                                                  │  │
│    │       ├── <OrbitControls autoRotate={!reducedMotion}>                   │  │
│    │       │       │                                                          │  │
│    │       │       └── controls.addEventListener('change', requestRender)    │  │
│    │       │                                                                  │  │
│    │       └── <Keyboard onReset={...} onPauseToggle={...}>                  │  │
│    │               │                                                          │  │
│    │               └── Arrow keys, +/-, R, Space, Escape                     │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│    cleanup: disposing = true ──► context.dispose()                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Upload Data Flow

```
                                    USER UPLOADS GLB FILE
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                                    │
│                                                                                  │
│    ┌─────────────┐         ┌─────────────────────────────────────────────────┐  │
│    │   <input    │         │              FormData                            │  │
│    │   type=file │ ──────► │   • model: File (GLB)                           │  │
│    │   />        │         │   • name: string                                 │  │
│    └─────────────┘         └──────────────────────────┬──────────────────────┘  │
│                                                       │                          │
└───────────────────────────────────────────────────────┼──────────────────────────┘
                                                        │
                                          POST /api/models/upload
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (+server.ts)                                 │
│                                                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                         RATE LIMITING                                    │  │
│    │                                                                          │  │
│    │    IP: 5/hour  ──┬──►  uploadLimiter.isLimited(event)                   │  │
│    │    IPUA: 3/15m ──┤            │                                          │  │
│    │    User: 20/hr ──┘            ▼                                          │  │
│    │                         ┌───────────┐                                    │  │
│    │                         │  429 if   │                                    │  │
│    │                         │  limited  │                                    │  │
│    │                         └───────────┘                                    │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                         AUTH CHECK                                       │  │
│    │                                                                          │  │
│    │    if (!locals.user) ──► error(401, 'Authentication required')          │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                      FILE SIZE CHECK                                     │  │
│    │                                                                          │  │
│    │    if (file.size > 10MB) ──► error(413, 'File too large')               │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                    MAGIC BYTE VALIDATION                                 │  │
│    │                        (validation.ts)                                   │  │
│    │                                                                          │  │
│    │    ┌────────────────────────────────────────────────────────────────┐   │  │
│    │    │  Bytes 0-3:   0x67 0x6C 0x54 0x46 ("glTF")     ◄── Magic      │   │  │
│    │    │  Bytes 4-7:   0x02 0x00 0x00 0x00 (version 2)  ◄── Version    │   │  │
│    │    │  Bytes 8-11:  [file length]                     ◄── Length     │   │  │
│    │    │  Bytes 12-15: [JSON chunk length]               ◄── Chunk 1    │   │  │
│    │    │  Bytes 16-19: 0x4E 0x4F 0x53 0x4A ("JSON")     ◄── Chunk type │   │  │
│    │    └────────────────────────────────────────────────────────────────┘   │  │
│    │                                                                          │  │
│    │    if (!valid) ──► error(415, 'Invalid file format')                    │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                    PRE-PARSE COMPLEXITY CHECK                            │  │
│    │                          (limits.ts)                                     │  │
│    │                                                                          │  │
│    │    Parse JSON chunk (before Three.js loads it)                          │  │
│    │                                                                          │  │
│    │    ┌─────────────────────────────────────────────────────────────────┐  │  │
│    │    │  Check:                        Limits:                          │  │  │
│    │    │  • vertices count              500,000 max                      │  │  │
│    │    │  • triangles count             250,000 max                      │  │  │
│    │    │  • texture count               16 max                           │  │  │
│    │    │  • material count              32 max                           │  │  │
│    │    │  • node count                  1,000 max                        │  │  │
│    │    │  • animation count             50 max                           │  │  │
│    │    └─────────────────────────────────────────────────────────────────┘  │  │
│    │                                                                          │  │
│    │    if (exceeds) ──► error(422, 'Model too complex')                     │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                      URI VALIDATION                                      │  │
│    │                         (uris.ts)                                        │  │
│    │                                                                          │  │
│    │    For each buffer.uri and image.uri:                                   │  │
│    │                                                                          │  │
│    │    ┌─────────────────────────────────────────────────────────────────┐  │  │
│    │    │  ✗ Block: http://, https://, file://, javascript:, gopher://   │  │  │
│    │    │  ✗ Block: // (protocol-relative)                                │  │  │
│    │    │  ✗ Block: / (absolute paths)                                    │  │  │
│    │    │  ✗ Block: .. or \ (traversal, including encoded)               │  │  │
│    │    │  ✓ Allow: data:image/png, data:image/jpeg, data:image/webp     │  │  │
│    │    │  ✓ Allow: relative paths (e.g., "texture.png")                  │  │  │
│    │    └─────────────────────────────────────────────────────────────────┘  │  │
│    │                                                                          │  │
│    │    if (external) ──► error(400, 'External URIs not allowed')            │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │ PASS                                        │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                      XSS SANITIZATION                                    │  │
│    │                       (sanitize.ts)                                      │  │
│    │                                                                          │  │
│    │    Recursive DOMPurify on:                                              │  │
│    │    • asset.copyright, asset.generator                                   │  │
│    │    • All *.name fields (meshes, nodes, materials, etc.)                 │  │
│    │    • All *.extras objects (recursive, preserve structure)               │  │
│    │    • All *.extensions objects                                           │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                             │
│                                    ▼                                             │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                    CONTENT-ADDRESSABLE HASH                              │  │
│    │                                                                          │  │
│    │    hash = SHA-256(buffer)                                               │  │
│    │    storageKey = `models/${hash}/model.glb`                              │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                             │
│                          ┌─────────┴─────────┐                                   │
│                          ▼                   ▼                                   │
│    ┌──────────────────────────┐   ┌──────────────────────────┐                  │
│    │      UPLOAD TO R2        │   │   INSERT TO POSTGRES     │                  │
│    │                          │   │                          │                  │
│    │  uploadToR2(             │   │  db.insert(models3d)     │                  │
│    │    storageKey,           │   │    .values({             │                  │
│    │    buffer,               │   │      id: 'm3d_xxx',      │                  │
│    │    'model/gltf-binary'   │   │      userId,             │                  │
│    │  )                       │   │      name,               │                  │
│    │                          │   │      slug,               │                  │
│    └──────────────────────────┘   │      format: 'glb',      │                  │
│              │                    │      status: 'ready',    │                  │
│              │                    │      polyCount,          │                  │
│              │                    │      storageKey,         │                  │
│              │                    │    })                    │                  │
│              │                    └──────────────────────────┘                  │
│              │                               │                                   │
│              └───────────────┬───────────────┘                                   │
│                              │                                                   │
│                              ▼                                                   │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │    return json({ id: 'm3d_xxx', slug: 'abc123' })                       │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Model Loading Data Flow

```
                              USER NAVIGATES TO /showcase/3d/[model]
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            +page.server.ts (Load Function)                       │
│                                                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │    // Auth + Ownership check                                            │  │
│    │    if (!locals.user) error(401)                                         │  │
│    │                                                                          │  │
│    │    const model = await db.query.models3d.findFirst({                    │  │
│    │      where: and(                                                         │  │
│    │        eq(models3d.id, params.model),                                   │  │
│    │        eq(models3d.userId, locals.user.id)  ◄── Ownership check         │  │
│    │      )                                                                   │  │
│    │    })                                                                    │  │
│    │                                                                          │  │
│    │    if (!model) error(404)                                               │  │
│    │                                                                          │  │
│    │    // Generate signed URL (1 hour expiry)                               │  │
│    │    const modelUrl = await getModelUrl(model.storageKey)                 │  │
│    │                                                                          │  │
│    │    return { model, modelUrl }                                           │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ SSR/Hydration
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               +page.svelte (Client)                              │
│                                                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │    let { data } = $props()  // { model, modelUrl }                      │  │
│    │                                                                          │  │
│    │    <Canvas>                                                             │  │
│    │      <Model src={data.modelUrl} />                                      │  │
│    │    </Canvas>                                                            │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            │ Model.svelte $effect()
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Model Loading Pipeline                              │
│                                                                                  │
│    ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐     │
│    │                   │    │                   │    │                   │     │
│    │   Check LRU      │───►│   Fetch from R2   │───►│   GLTFLoader     │     │
│    │   Cache          │    │   (signed URL)    │    │   + DRACOLoader  │     │
│    │                   │    │                   │    │                   │     │
│    └───────────────────┘    └───────────────────┘    └───────────────────┘     │
│           │                                                  │                   │
│           │ HIT                                               │                   │
│           ▼                                                  ▼                   │
│    ┌───────────────────┐                          ┌───────────────────┐         │
│    │                   │                          │                   │         │
│    │   Return clone   │                          │   Parse GLB:     │         │
│    │   from cache     │                          │   • JSON chunk   │         │
│    │                   │                          │   • Binary chunk │         │
│    └───────────────────┘                          │   • Draco decode │         │
│                                                   │                   │         │
│                                                   └─────────┬─────────┘         │
│                                                             │                    │
│                                                             ▼                    │
│                                                   ┌───────────────────┐         │
│                                                   │                   │         │
│                                                   │   Store in LRU   │         │
│                                                   │   Cache (clone   │         │
│                                                   │   for return)    │         │
│                                                   │                   │         │
│                                                   └─────────┬─────────┘         │
│                                                             │                    │
└─────────────────────────────────────────────────────────────┼────────────────────┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Scene Graph Update                                  │
│                                                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │    // In Model.svelte $effect()                                         │  │
│    │                                                                          │  │
│    │    if (previousModel) {                                                 │  │
│    │      context.scene.remove(previousModel)                                │  │
│    │      disposeObject(previousModel)  ◄── Cleanup GPU memory               │  │
│    │    }                                                                     │  │
│    │                                                                          │  │
│    │    context.scene.add(loadedModel)                                       │  │
│    │    context.requestRender()  ◄── Trigger on-demand render                │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WebGL Rendering                                     │
│                                                                                  │
│    ┌─────────────────────────────────────────────────────────────────────────┐  │
│    │                                                                          │  │
│    │                    ┌─────────────────────────────┐                      │  │
│    │                    │      THREE.Scene            │                      │  │
│    │                    │                             │                      │  │
│    │                    │   ┌─────────────────────┐   │                      │  │
│    │                    │   │   AmbientLight      │   │                      │  │
│    │                    │   └─────────────────────┘   │                      │  │
│    │                    │   ┌─────────────────────┐   │                      │  │
│    │                    │   │  DirectionalLight   │   │                      │  │
│    │                    │   └─────────────────────┘   │                      │  │
│    │                    │   ┌─────────────────────┐   │                      │  │
│    │                    │   │   Loaded Model      │   │                      │  │
│    │                    │   │   (GLTF scene)      │   │                      │  │
│    │                    │   └─────────────────────┘   │                      │  │
│    │                    │                             │                      │  │
│    │                    └─────────────────────────────┘                      │  │
│    │                                  │                                       │  │
│    │                                  ▼                                       │  │
│    │                    ┌─────────────────────────────┐                      │  │
│    │                    │   WebGLRenderer.render()    │                      │  │
│    │                    │   (on-demand, not loop)     │                      │  │
│    │                    └─────────────────────────────┘                      │  │
│    │                                  │                                       │  │
│    │                                  ▼                                       │  │
│    │                    ┌─────────────────────────────┐                      │  │
│    │                    │        <canvas>             │                      │  │
│    │                    │                             │                      │  │
│    │                    └─────────────────────────────┘                      │  │
│    │                                                                          │  │
│    └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Relationships

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL (Neon)                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────┐              ┌─────────────────────────┐
    │         user            │              │       models_3d         │
    │   (_better-auth.ts)     │              │     (models3d.ts)       │
    ├─────────────────────────┤              ├─────────────────────────┤
    │ id          TEXT PK     │◄────────────┐│ id          TEXT PK     │
    │ name        TEXT        │             ││ user_id     TEXT FK ────┘
    │ email       TEXT UNIQUE │             ││ name        TEXT        │
    │ image       TEXT        │             ││ slug        TEXT        │
    │ created_at  TIMESTAMP   │             ││ description TEXT        │
    │ updated_at  TIMESTAMP   │             ││ format      ENUM        │
    └─────────────────────────┘             ││ status      ENUM        │
                                            ││ poly_count  INT         │
                                            ││ vertex_count INT        │
                                            ││ file_size   INT         │
                                            ││ storage_key TEXT        │
                                            ││ thumbnail_key TEXT      │
                                            ││ created_at  TIMESTAMP   │
                                            ││ updated_at  TIMESTAMP   │
                                            │└─────────────────────────┘
                                            │
                                            │  INDEXES:
                                            │  • models_3d_user_idx (user_id)
                                            │  • models_3d_status_idx (status)
                                            │  • models_3d_user_created_idx (user_id, created_at)
                                            │  • models_3d_storage_key_idx (storage_key)
                                            │  • models_3d_user_slug_idx UNIQUE (user_id, slug)


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NEO4J (Aura) - Similarity Only                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────┐
                    │     :Model3D      │
                    │                   │
                    │  pgId: "m3d_xxx"  │◄──── References PostgreSQL
                    │                   │
                    └─────────┬─────────┘
                              │
                              │ [:SIMILAR_TO]
                              │ {
                              │   score: 0.85,
                              │   computedAt: datetime
                              │ }
                              │
                              ▼
                    ┌───────────────────┐
                    │     :Model3D      │
                    │                   │
                    │  pgId: "m3d_yyy"  │
                    │                   │
                    └───────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE R2                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

    models/
    │
    ├── a1b2c3d4e5f6.../                ◄── SHA-256 hash (content-addressable)
    │   ├── model.glb                   ◄── Original compressed GLB
    │   ├── model-lod0.glb              ◄── High detail LOD
    │   ├── model-lod1.glb              ◄── Medium detail LOD
    │   ├── model-lod2.glb              ◄── Low detail LOD
    │   └── thumbnail.webp              ◄── Preview image
    │
    ├── f7e8d9c0b1a2.../
    │   ├── model.glb
    │   └── thumbnail.webp
    │
    └── ...

    Benefits:
    • Deduplication: Same file = same hash = stored once
    • Integrity: Hash verifies file hasn't changed
    • CDN: Edge-cached globally
    • No egress fees
```

---

## Memory Management Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LRU CACHE LIFECYCLE                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

    Cache State: [model-a, model-b, model-c, ...] (max 10)
                     ▲                        ▲
                   oldest                   newest

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  SCENARIO 1: Cache Hit                                                   │
    │                                                                          │
    │    loadGLTF("model-b")                                                  │
    │           │                                                              │
    │           ▼                                                              │
    │    ┌─────────────┐                                                      │
    │    │ cache.get() │ ──► Found!                                           │
    │    └─────────────┘                                                      │
    │           │                                                              │
    │           ▼                                                              │
    │    Move to end: [model-a, model-c, ..., model-b]                        │
    │           │                                                              │
    │           ▼                                                              │
    │    Return model-b.clone()  ◄── Clone to prevent mutation                │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  SCENARIO 2: Cache Miss (Under Limit)                                    │
    │                                                                          │
    │    loadGLTF("model-new")                                                │
    │           │                                                              │
    │           ▼                                                              │
    │    ┌─────────────┐                                                      │
    │    │ cache.get() │ ──► Not found                                        │
    │    └─────────────┘                                                      │
    │           │                                                              │
    │           ▼                                                              │
    │    Fetch from R2 ──► GLTFLoader.load()                                  │
    │           │                                                              │
    │           ▼                                                              │
    │    cache.set("model-new", loadedModel)                                  │
    │           │                                                              │
    │           ▼                                                              │
    │    [model-a, model-b, ..., model-new]  (size < 10, no eviction)         │
    │           │                                                              │
    │           ▼                                                              │
    │    Return loadedModel.clone()                                           │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │  SCENARIO 3: Cache Miss (At Limit - Eviction)                            │
    │                                                                          │
    │    Cache: [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10]  (size = 10)        │
    │                                                                          │
    │    loadGLTF("model-new")                                                │
    │           │                                                              │
    │           ▼                                                              │
    │    ┌─────────────┐                                                      │
    │    │ cache.get() │ ──► Not found                                        │
    │    └─────────────┘                                                      │
    │           │                                                              │
    │           ▼                                                              │
    │    Fetch from R2 ──► GLTFLoader.load()                                  │
    │           │                                                              │
    │           ▼                                                              │
    │    cache.set("model-new", loadedModel)                                  │
    │           │                                                              │
    │           ├──► Evict oldest (m1)                                        │
    │           │         │                                                    │
    │           │         ▼                                                    │
    │           │    ┌─────────────────────────────────────────────┐          │
    │           │    │            disposeObject(m1)                │          │
    │           │    │                                             │          │
    │           │    │  m1.traverse((child) => {                   │          │
    │           │    │    if (child instanceof Mesh) {             │          │
    │           │    │      child.geometry.dispose()               │          │
    │           │    │      child.material.dispose()               │          │
    │           │    │      // Dispose all textures                │          │
    │           │    │    }                                        │          │
    │           │    │  })                                         │          │
    │           │    │                                             │          │
    │           │    └─────────────────────────────────────────────┘          │
    │           │                                                              │
    │           ▼                                                              │
    │    [m2, m3, m4, m5, m6, m7, m8, m9, m10, model-new]                     │
    │           │                                                              │
    │           ▼                                                              │
    │    Return loadedModel.clone()                                           │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT UNMOUNT CLEANUP                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

    User navigates away from /showcase/3d/...
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │  +layout.svelte: beforeNavigate()                                     │
    │                                                                       │
    │    if (to && !to.route.id?.startsWith('/showcase/3d')) {             │
    │      clearCache()  ──► Dispose ALL cached models                     │
    │    }                                                                  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │  Canvas.svelte: onMount cleanup                                       │
    │                                                                       │
    │    return () => {                                                     │
    │      disposing = true   ◄── Signal children to stop                  │
    │      context?.dispose() ◄── Dispose renderer, scene, etc.            │
    │      context = null                                                   │
    │    }                                                                  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │  Model.svelte: $effect cleanup                                        │
    │                                                                       │
    │    return () => {                                                     │
    │      cancelled = true                                                 │
    │      if (loadedModel) {                                              │
    │        context.scene.remove(loadedModel)                             │
    │        disposeObject(loadedModel)                                    │
    │      }                                                                │
    │    }                                                                  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
```

---

## Keyboard Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KEYBOARD NAVIGATION                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

    User focuses <canvas tabindex="0">
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │  FOCUS EVENT                                                          │
    │                                                                       │
    │  Announce via live region:                                           │
    │  "3D viewer focused. Use arrow keys to rotate, +/- to zoom,          │
    │   R to reset, Escape to exit."                                       │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    │ User presses key
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                      KEY DISPATCH                                     │
    │                                                                       │
    │    ┌────────────────┬─────────────────────────────────────────────┐  │
    │    │     KEY        │              ACTION                         │  │
    │    ├────────────────┼─────────────────────────────────────────────┤  │
    │    │  ArrowLeft     │  rotateCamera(-0.1, 0)  // θ -= 6°          │  │
    │    │  ArrowRight    │  rotateCamera(+0.1, 0)  // θ += 6°          │  │
    │    │  ArrowUp       │  rotateCamera(0, -0.1)  // φ -= 6°          │  │
    │    │  ArrowDown     │  rotateCamera(0, +0.1)  // φ += 6°          │  │
    │    │  + / =         │  zoomCamera(-0.5)       // closer           │  │
    │    │  -             │  zoomCamera(+0.5)       // farther          │  │
    │    │  R             │  resetCamera()          // initial pos      │  │
    │    │  Space         │  togglePause()          // auto-rotate      │  │
    │    │  Escape        │  canvas.blur()          // exit focus       │  │
    │    └────────────────┴─────────────────────────────────────────────┘  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    │ Action executed
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                                                                       │
    │    event.preventDefault()                                            │
    │    context.requestRender()  ◄── Trigger visual update                │
    │                                                                       │
    │    if (action === 'reset') {                                         │
    │      announceStatus('Camera reset')  ◄── Screen reader feedback      │
    │    }                                                                  │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CAMERA ROTATION (Spherical)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                              Y (up)
                              │
                              │    θ (theta) = horizontal angle
                              │    φ (phi) = vertical angle
                              │
                              │         camera
                              │        /
                              │       /  r (radius)
                              │      /
                              │     / φ
                              │    /
                              └────────────────── X
                             /  θ
                            /
                           /
                          Z


    rotateCamera(deltaTheta, deltaPhi):
        spherical.setFromVector3(camera.position)
        spherical.theta += deltaTheta
        spherical.phi = clamp(0.1, PI - 0.1, spherical.phi + deltaPhi)
        camera.position.setFromSpherical(spherical)
        camera.lookAt(0, 0, 0)

    zoomCamera(delta):
        direction = camera.position.normalize()
        camera.position.addScaledVector(direction, delta)
        distance = clamp(1, 20, camera.position.length())
        camera.position.setLength(distance)
```

---

## Security Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY VALIDATION GATES                               │
└─────────────────────────────────────────────────────────────────────────────────┘

    Uploaded GLB File
          │
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 1: Magic Bytes                                                     │
    │                                                                          │
    │    Bytes 0-3 must be: 0x67 0x6C 0x54 0x46 ("glTF")                       │
    │                                                                          │
    │    ✗ FAIL → 415 "Invalid file format"                                   │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 2: Version Check                                                   │
    │                                                                          │
    │    Bytes 4-7 (uint32 LE) must be: 2                                     │
    │                                                                          │
    │    ✗ FAIL → 415 "Unsupported glTF version"                              │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 3: Length Validation                                               │
    │                                                                          │
    │    Bytes 8-11 (declared length) must equal buffer.byteLength            │
    │                                                                          │
    │    ✗ FAIL → 415 "File length mismatch"                                  │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 4: Chunk Type Validation                                           │
    │                                                                          │
    │    Chunk 1 type (bytes 16-19) must be: 0x4E4F534A ("JSON")              │
    │    Chunk 2 type (if present) must be: 0x004E4942 ("BIN\0")              │
    │                                                                          │
    │    ✗ FAIL → 415 "Invalid GLB chunk structure"                           │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 5: Complexity Limits (Pre-parse)                                   │
    │                                                                          │
    │    Parse JSON chunk, count from accessors:                              │
    │                                                                          │
    │    ┌─────────────────┬────────────┬───────────────────────────────────┐ │
    │    │     Metric      │   Limit    │            Check                  │ │
    │    ├─────────────────┼────────────┼───────────────────────────────────┤ │
    │    │  Vertices       │  500,000   │  Sum of POSITION accessor counts  │ │
    │    │  Triangles      │  250,000   │  Sum of indices / 3               │ │
    │    │  Textures       │  16        │  textures.length                  │ │
    │    │  Materials      │  32        │  materials.length                 │ │
    │    │  Nodes          │  1,000     │  nodes.length                     │ │
    │    │  Animations     │  50        │  animations.length                │ │
    │    └─────────────────┴────────────┴───────────────────────────────────┘ │
    │                                                                          │
    │    ✗ FAIL → 422 "Model exceeds complexity limits"                       │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 6: URI Validation                                                  │
    │                                                                          │
    │    For each buffer.uri and image.uri:                                   │
    │                                                                          │
    │    ┌────────────────────────────────────────────────────────────────┐   │
    │    │  BLOCKED:                                                      │   │
    │    │  • http://*, https://*     (external fetch)                    │   │
    │    │  • file://*                (local file access)                 │   │
    │    │  • javascript:*            (script execution)                  │   │
    │    │  • //*                     (protocol-relative)                 │   │
    │    │  • /*                      (absolute paths)                    │   │
    │    │  • %2e%2e, .., \           (path traversal)                   │   │
    │    │  • data:text/html          (HTML injection)                    │   │
    │    │                                                                │   │
    │    │  ALLOWED:                                                      │   │
    │    │  • data:image/png;base64,... (safe image data)                │   │
    │    │  • data:image/jpeg;base64,...                                  │   │
    │    │  • data:application/octet-stream;base64,...                    │   │
    │    │  • texture.png             (relative, same-origin)             │   │
    │    └────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    │    ✗ FAIL → 400 "External/malicious URI detected"                       │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │  GATE 7: XSS Sanitization                                                │
    │                                                                          │
    │    DOMPurify.sanitize() with ALLOWED_TAGS: [] on:                       │
    │                                                                          │
    │    • asset.copyright, asset.generator                                   │
    │    • All *.name fields (recursive)                                      │
    │    • All *.extras objects (recursive, preserve structure)               │
    │    • All *.extensions objects (recursive)                               │
    │                                                                          │
    │    Input:  { name: "<script>alert(1)</script>Model" }                   │
    │    Output: { name: "Model" }                                            │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘
          │ ✓
          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                                                                          │
    │    ✓ VALIDATION PASSED - Proceed to storage                             │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## CSP Headers Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       CONTENT SECURITY POLICY                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

    Request: GET /showcase/3d/model-123
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │  hooks.server.ts                                                      │
    │                                                                       │
    │    if (pathname.startsWith('/showcase/3d') ||                        │
    │        pathname.startsWith('/app/models')) {                         │
    │                                                                       │
    │      response.headers.set('Content-Security-Policy', ...)            │
    │                                                                       │
    │    }                                                                  │
    └───────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                                                                           │
    │   Content-Security-Policy:                                               │
    │                                                                           │
    │   ┌─────────────────────────────────────────────────────────────────────┐│
    │   │  default-src 'self'                                                 ││
    │   │    └── Fallback: only same-origin                                   ││
    │   │                                                                     ││
    │   │  script-src 'self' 'wasm-unsafe-eval'                               ││
    │   │    └── Same-origin scripts + WASM (Draco decoder)                   ││
    │   │    └── NO 'unsafe-inline' for scripts!                              ││
    │   │                                                                     ││
    │   │  style-src 'self' 'unsafe-inline'                                   ││
    │   │    └── Svelte transitions require inline styles                     ││
    │   │                                                                     ││
    │   │  img-src 'self' data: blob: https://r2.example.com                  ││
    │   │    └── Same-origin images                                           ││
    │   │    └── data: URIs (embedded textures)                               ││
    │   │    └── blob: URIs (generated previews)                              ││
    │   │    └── R2 CDN for stored models                                     ││
    │   │                                                                     ││
    │   │  connect-src 'self' https://r2.example.com                          ││
    │   │    └── XHR/fetch to same-origin and R2                              ││
    │   │                                                                     ││
    │   │  worker-src 'self' blob:                                            ││
    │   │    └── Draco decoder web worker                                     ││
    │   │                                                                     ││
    │   │  object-src 'none'                                                  ││
    │   │    └── Block Flash, plugins                                         ││
    │   │                                                                     ││
    │   │  base-uri 'self'                                                    ││
    │   │    └── Prevent <base> tag hijacking                                 ││
    │   │                                                                     ││
    │   │  form-action 'self'                                                 ││
    │   │    └── Forms only submit to same-origin                             ││
    │   │                                                                     ││
    │   │  frame-ancestors 'none'                                             ││
    │   │    └── Prevent clickjacking (no embedding)                          ││
    │   └─────────────────────────────────────────────────────────────────────┘│
    │                                                                           │
    └───────────────────────────────────────────────────────────────────────────┘
```
