# 3D Architecture

Technical architecture for 3D model visualization in Velociraptor.

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Renderer | Three.js | ^0.175.0 | WebGL/WebGPU rendering |
| Svelte Bindings | Threlte | v9 | Declarative 3D components |
| Format | glTF 2.0 | ISO 12113:2022 | Model interchange |
| Geometry Compression | Draco | 1.5.x | 90-95% size reduction |
| Texture Compression | Basis Universal | KTX2 | GPU-compressed textures |
| Storage | Cloudflare R2 | S3-compatible | Content-addressable blobs |
| Metadata | PostgreSQL (Neon) | via Drizzle | ACID model records |
| Relationships | Neo4j (Aura) | for similarity | Graph traversal for recommendations |

## File Structure

```
src/lib/
├── 3d/                              # Engine layer (NO Svelte imports)
│   ├── index.ts                     # Public API exports
│   ├── types.ts                     # Scene3DContext, Model3D, etc.
│   ├── context.ts                   # Typed context helpers
│   ├── engine/
│   │   ├── scene.ts                 # Scene management
│   │   ├── camera.ts                # Camera utilities
│   │   ├── loader.ts                # GLTF loader with LRU cache
│   │   ├── lod.ts                   # Level of detail
│   │   └── dispose.ts               # Memory cleanup
│   └── renderers/
│       └── three.ts                 # Three.js adapter
│
├── server/
│   └── 3d/                          # Server-only validation
│       ├── validation.ts            # Magic bytes, complexity checks
│       └── limits.ts                # Single source of truth for limits
│
├── shared/
│   └── 3d/
│       └── types.ts                 # Shared types (client + server)
│
├── components/
│   └── 3d/
│       ├── index.ts                 # Re-exports
│       ├── Canvas.svelte            # Root wrapper
│       ├── Model.svelte             # GLTF model
│       └── controls/
│           ├── Orbit.svelte         # OrbitControls
│           └── Keyboard.svelte      # Keyboard navigation

src/routes/showcase/3d/
├── +layout.svelte                   # Cache cleanup on navigation
├── +page.svelte                     # Gallery
├── +page.server.ts                  # Model metadata from DB
└── [model]/
    ├── +page.svelte                 # Viewer
    ├── +page.server.ts              # Auth + ownership check
    └── +page.ts                     # Asset preloading
```

## Layer Separation

### Shared Types (`$lib/shared/3d/`)

Types used by both client and server.

```typescript
// $lib/shared/3d/types.ts
export interface ComplexityLimits {
  maxVertices: number;
  maxTriangles: number;
  maxTextureSize: number;
  maxTextures: number;
  maxFileSize: number;
  maxNodes: number;
  maxMaterials: number;
  maxAnimations: number;
}

export const DEFAULT_LIMITS: ComplexityLimits = {
  maxVertices: 500_000,
  maxTriangles: 250_000,
  maxTextureSize: 4096,
  maxTextures: 16,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxNodes: 1000,
  maxMaterials: 32,
  maxAnimations: 50,
};
```

### Engine Layer (`$lib/3d/`)

Pure TypeScript, framework-agnostic. No Svelte imports.

```typescript
// $lib/3d/types.ts
export interface Scene3DContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  requestRender: () => void;
  start: () => void;
  dispose: () => void;
}

export interface Model3DAsset {
  id: string;
  url: string;
  format: 'glb' | 'gltf';
}

export interface LoaderOptions {
  dracoPath?: string;
  ktx2Path?: string;
  onProgress?: (progress: number) => void;
}
```

### Typed Context Helpers (`$lib/3d/context.ts`)

**CRITICAL**: Use Symbol keys and typed helpers, not magic strings.

```typescript
// $lib/3d/context.ts
import { getContext, setContext, hasContext } from 'svelte';
import type { Scene3DContext } from './types';

const SCENE_KEY = Symbol('scene3d');

export interface Scene3DContextValue {
  readonly context: Scene3DContext | null;
  readonly disposing: boolean;
}

export function setSceneContext(value: Scene3DContextValue): void {
  setContext(SCENE_KEY, value);
}

export function getSceneContext(): Scene3DContextValue {
  if (!hasContext(SCENE_KEY)) {
    throw new Error('Scene context not found. Ensure component is wrapped in <Canvas>.');
  }
  return getContext<Scene3DContextValue>(SCENE_KEY);
}

export function tryGetSceneContext(): Scene3DContextValue | null {
  return hasContext(SCENE_KEY) ? getContext<Scene3DContextValue>(SCENE_KEY) : null;
}
```

### Svelte Layer (`$lib/components/3d/`)

Thin wrappers that use runes and connect to engine.

```svelte
<!-- $lib/components/3d/Canvas.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { setSceneContext } from '$lib/3d/context';
  import type { Snippet } from 'svelte';
  import type { Scene3DContext } from '$lib/3d/types';

  interface Props {
    children?: Snippet;
    antialias?: boolean;
    alpha?: boolean;
    class?: string;
  }

  let { children, antialias = true, alpha = false, class: className = '' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let context = $state<Scene3DContext | null>(null);
  let mounted = $state(false);
  let disposing = $state(false);

  // Provide reactive context to children
  setSceneContext({
    get context() { return context; },
    get disposing() { return disposing; }
  });

  onMount(() => {
    if (!browser) return;

    let disposed = false;

    // Dynamic import to enable code splitting
    import('$lib/3d/engine/scene').then(({ createScene }) => {
      if (disposed) return; // Component unmounted during import

      context = createScene(canvas, { antialias, alpha });
      mounted = true;
      context.start();
    });

    return () => {
      disposed = true;
      disposing = true; // Signal children to stop operations
      context?.dispose();
      context = null;
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="block w-full h-full {className}"
  tabindex="0"
  role="application"
  aria-label="3D model viewer. Use arrow keys to rotate, +/- to zoom, R to reset, Escape to exit."
>
  {#if mounted && children}
    {@render children()}
  {/if}
</canvas>
```

## Rendering Strategy

### On-Demand Rendering (Default)

Only render when state changes. Critical for battery life.

```typescript
// $lib/3d/engine/scene.ts
import * as THREE from 'three';
import type { Scene3DContext } from '../types';

export function createScene(
  canvas: HTMLCanvasElement,
  options: { antialias?: boolean; alpha?: boolean } = {}
): Scene3DContext {
  if (!canvas || !canvas.isConnected) {
    throw new Error('Canvas must be attached to the DOM');
  }

  const { antialias = true, alpha = false } = options;

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene
  const scene = new THREE.Scene();
  scene.background = alpha ? null : new THREE.Color(0x1a1a2e);

  // Camera
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 1, 3);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(5, 5, 5);
  scene.add(ambient, directional);

  // On-demand rendering
  let frameRequested = false;
  let running = false;

  function render() {
    frameRequested = false;
    if (running) {
      renderer.render(scene, camera);
    }
  }

  function requestRender() {
    if (!frameRequested && running) {
      frameRequested = true;
      requestAnimationFrame(render);
    }
  }

  // Resize handling
  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;

    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      requestRender();
    }
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  function start() {
    running = true;
    resize();
    requestRender();
  }

  function dispose() {
    running = false;
    resizeObserver.disconnect();
    renderer.dispose();

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => {
          if (m) {
            // Dispose textures
            for (const key of Object.keys(m)) {
              const value = (m as Record<string, unknown>)[key];
              if (value instanceof THREE.Texture) {
                value.dispose();
              }
            }
            m.dispose();
          }
        });
      }
    });
  }

  return { scene, camera, renderer, requestRender, start, dispose };
}
```

### LRU Cache for Models

**CRITICAL**: Bounded cache to prevent memory leaks.

```typescript
// $lib/3d/engine/loader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { LoaderOptions } from '../types';
import { disposeObject } from './dispose';

// LRU Cache with size limit
class LRUCache<K, V> {
  private max: number;
  private cache = new Map<K, V>();
  private onEvict?: (value: V) => void;

  constructor(max: number, onEvict?: (value: V) => void) {
    this.max = max;
    this.onEvict = onEvict;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.max) {
      // Delete oldest (first item)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        const oldValue = this.cache.get(oldest);
        this.cache.delete(oldest);
        if (oldValue && this.onEvict) {
          this.onEvict(oldValue);
        }
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    if (this.onEvict) {
      this.cache.forEach((value) => this.onEvict!(value));
    }
    this.cache.clear();
  }
}

// Cache with automatic disposal on eviction
const modelCache = new LRUCache<string, THREE.Group>(10, (model) => {
  disposeObject(model);
});

let loader: GLTFLoader | null = null;
let dracoLoader: DRACOLoader | null = null;

function getLoader(options: LoaderOptions = {}): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(options.dracoPath || '/draco/');
    loader.setDRACOLoader(dracoLoader);
  }
  return loader;
}

export async function loadGLTF(
  url: string,
  options: LoaderOptions = {}
): Promise<THREE.Group> {
  // Check cache
  const cached = modelCache.get(url);
  if (cached) {
    return cached.clone();
  }

  const gltfLoader = getLoader(options);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        modelCache.set(url, gltf.scene);
        resolve(gltf.scene.clone());
      },
      (progress) => {
        if (options.onProgress && progress.total > 0) {
          options.onProgress(progress.loaded / progress.total);
        }
      },
      (error) => reject(error)
    );
  });
}

export function clearCache(): void {
  modelCache.clear();
}
```

## Data Model

### Polyglot Persistence

| Store | Data | Why |
|-------|------|-----|
| PostgreSQL | Model metadata, user ownership, tags | ACID, auth integration |
| Neo4j | Similarity relationships only | Graph traversal for recommendations |
| R2 | Binary model files | CDN, deduplication |

### PostgreSQL Schema (Drizzle)

```typescript
// src/lib/server/db/schema/models3d.ts
import { pgTable, text, integer, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './_better-auth';  // CORRECT: Better Auth user table
import { createId } from '../id';

export const modelFormatEnum = pgEnum('model_format', ['glb', 'gltf']);
export const modelStatusEnum = pgEnum('model_status', ['uploading', 'processing', 'ready', 'failed']);

export const models3d = pgTable('models_3d', {
  id: text('id').primaryKey().$defaultFn(() => createId.model3d()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),

  // Metadata
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),

  // Technical
  format: modelFormatEnum('format').notNull(),
  status: modelStatusEnum('status').notNull().default('uploading'),
  polyCount: integer('poly_count'),
  vertexCount: integer('vertex_count'),
  fileSize: integer('file_size').notNull(),

  // Storage
  storageKey: text('storage_key').notNull(),
  thumbnailKey: text('thumbnail_key'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('models_3d_user_idx').on(table.userId),
  index('models_3d_status_idx').on(table.status),
  index('models_3d_user_created_idx').on(table.userId, table.createdAt),
  index('models_3d_storage_key_idx').on(table.storageKey),
  uniqueIndex('models_3d_user_slug_idx').on(table.userId, table.slug),
]);

// Type inference
export type Model3D = typeof models3d.$inferSelect;
export type NewModel3D = typeof models3d.$inferInsert;
```

### ID Generation

```typescript
// src/lib/server/db/id.ts
import { nanoid } from 'nanoid';

export const createId = {
  // ... existing IDs
  model3d: () => `m3d_${nanoid(12)}`,
};
```

### Relations Export

```typescript
// src/lib/server/db/relations.ts
import { relations } from 'drizzle-orm';
import { models3d } from './schema/models3d';
import { user } from './schema/_better-auth';

export const models3dRelations = relations(models3d, ({ one }) => ({
  user: one(user, {
    fields: [models3d.userId],
    references: [user.id]
  }),
}));
```

### Neo4j Graph Model (Similarity Only)

```cypher
// Nodes - reference only (data lives in Postgres)
(:Model3D {pgId: string})  // pgId references models_3d.id

// Relationships - graph-native (computed by batch job)
(:Model3D)-[:SIMILAR_TO {score: float, computedAt: datetime}]->(:Model3D)
```

Neo4j is used **only** for similarity/recommendations where graph traversal provides value. Ownership and tagging remain in PostgreSQL.

### R2 Storage Structure

```
models/
├── {content-hash}/
│   ├── model.glb           # Original compressed
│   ├── model-lod0.glb      # High detail
│   ├── model-lod1.glb      # Medium detail
│   ├── model-lod2.glb      # Low detail
│   └── thumbnail.webp      # Preview image
```

Content-addressable: SHA-256 hash of file content = folder name. Enables deduplication.

## Route Cleanup (SPA-Safe)

**Do NOT use `data-sveltekit-reload`** - it breaks SPA navigation. Use navigation hooks instead.

```svelte
<!-- src/routes/showcase/3d/+layout.svelte -->
<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { clearCache } from '$lib/3d/engine/loader';

  let { children } = $props();

  // Clear WebGL cache when leaving 3D section
  beforeNavigate(({ to }) => {
    if (to && !to.route.id?.startsWith('/showcase/3d')) {
      clearCache();
    }
  });
</script>

{@render children()}
```

## Auth Integration

### Route Protection

```typescript
// src/routes/showcase/3d/[model]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { models3d } from '$lib/server/db/schema/models3d';
import { eq, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    error(401, 'Authentication required');
  }

  const model = await db.query.models3d.findFirst({
    where: and(
      eq(models3d.id, params.model),
      eq(models3d.userId, locals.user.id)  // Ownership check
    )
  });

  if (!model) {
    error(404, 'Model not found');
  }

  return { model };
};
```

## Vite Configuration

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: ['three', '@threlte/core', '@threlte/extras']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-loaders': [
            'three/examples/jsm/loaders/GLTFLoader',
            'three/examples/jsm/loaders/DRACOLoader',
            'three/examples/jsm/loaders/KTX2Loader'
          ]
        }
      }
    }
  }
});
```

## WebGPU Progressive Enhancement

```typescript
// $lib/3d/renderers/three.ts
export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions
): Promise<Scene3DContext> {
  // Try WebGPU first
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const WebGPURenderer = await import('three/webgpu')
          .then(m => m.WebGPURenderer)
          .catch(() => null);

        if (WebGPURenderer) {
          return createWebGPUContext(canvas, options);
        }
      }
    } catch {
      // Fall through to WebGL
    }
  }

  // Default to WebGL
  return createWebGLContext(canvas, options);
}
```
