# 3D Implementation Plan

Phased implementation approach for 3D model visualization.

## Phase 1: Foundation

Core rendering infrastructure and basic viewer.

### 1.1 Install Dependencies

```bash
# In container (via package.json, then restart)
# package.json additions:
{
  "dependencies": {
    "three": "^0.175.0",
    "@threlte/core": "^9.0.0",
    "@threlte/extras": "^9.0.0"
  },
  "devDependencies": {
    "@types/three": "^0.175.0"
  }
}
```

### 1.2 Create Engine Layer

**`src/lib/3d/types.ts`**
```typescript
import type * as THREE from 'three';

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

export interface ComplexityLimits {
  maxVertices: number;
  maxTriangles: number;
  maxTextureSize: number;
  maxFileSize: number;
}

export const DEFAULT_LIMITS: ComplexityLimits = {
  maxVertices: 500_000,
  maxTriangles: 250_000,
  maxTextureSize: 4096,
  maxFileSize: 10 * 1024 * 1024, // 10MB
};
```

**`src/lib/3d/engine/scene.ts`**
```typescript
import * as THREE from 'three';
import type { Scene3DContext } from '../types';

export function createScene(
  canvas: HTMLCanvasElement,
  options: { antialias?: boolean; alpha?: boolean } = {}
): Scene3DContext {
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
    renderer.render(scene, camera);
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
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }

  return { scene, camera, renderer, requestRender, start, dispose };
}
```

**`src/lib/3d/engine/loader.ts`**
```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { LoaderOptions, ComplexityLimits } from '../types';
import { validateComplexity } from './limits';

const cache = new Map<string, THREE.Group>();
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
  options: LoaderOptions = {},
  limits?: ComplexityLimits
): Promise<THREE.Group> {
  // Check cache
  if (cache.has(url)) {
    return cache.get(url)!.clone();
  }

  const gltfLoader = getLoader(options);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        // Validate complexity if limits provided
        if (limits) {
          const validation = validateComplexity(gltf.scene, limits);
          if (!validation.valid) {
            reject(new Error(`Model exceeds limits: ${validation.reason}`));
            return;
          }
        }

        cache.set(url, gltf.scene);
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

export function clearCache() {
  cache.forEach((model) => {
    model.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      }
    });
  });
  cache.clear();
}
```

**`src/lib/3d/engine/limits.ts`**
```typescript
import * as THREE from 'three';
import type { ComplexityLimits } from '../types';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  stats: {
    vertices: number;
    triangles: number;
    textures: number;
  };
}

export function validateComplexity(
  object: THREE.Object3D,
  limits: ComplexityLimits
): ValidationResult {
  let vertices = 0;
  let triangles = 0;
  let textures = 0;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry;
      if (geo.index) {
        triangles += geo.index.count / 3;
      } else if (geo.attributes.position) {
        triangles += geo.attributes.position.count / 3;
      }
      if (geo.attributes.position) {
        vertices += geo.attributes.position.count;
      }

      // Count textures
      const mat = child.material;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        if (m instanceof THREE.MeshStandardMaterial) {
          if (m.map) textures++;
          if (m.normalMap) textures++;
          if (m.roughnessMap) textures++;
          if (m.metalnessMap) textures++;
        }
      }
    }
  });

  const stats = { vertices, triangles, textures };

  if (vertices > limits.maxVertices) {
    return { valid: false, reason: `Vertices (${vertices}) exceed limit (${limits.maxVertices})`, stats };
  }
  if (triangles > limits.maxTriangles) {
    return { valid: false, reason: `Triangles (${triangles}) exceed limit (${limits.maxTriangles})`, stats };
  }

  return { valid: true, stats };
}
```

### 1.3 Create Svelte Components

**`src/lib/components/3d/Canvas.svelte`**
```svelte
<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import { createScene } from '$lib/3d/engine/scene';
  import type { Scene3DContext } from '$lib/3d/types';

  interface Props {
    children?: Snippet;
    antialias?: boolean;
    alpha?: boolean;
    class?: string;
  }

  let { children, antialias = true, alpha = false, class: className = '' }: Props = $props();

  let canvas: HTMLCanvasElement;
  let context: Scene3DContext | null = $state(null);
  let mounted = $state(false);

  setContext('scene3d', {
    get context() { return context; }
  });

  onMount(() => {
    context = createScene(canvas, { antialias, alpha });
    mounted = true;
    context.start();
    return () => context?.dispose();
  });
</script>

<canvas bind:this={canvas} class="block w-full h-full {className}">
  {#if mounted && children}
    {@render children()}
  {/if}
</canvas>
```

**`src/lib/components/3d/Model.svelte`**
```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import * as THREE from 'three';
  import { loadGLTF } from '$lib/3d/engine/loader';
  import { DEFAULT_LIMITS } from '$lib/3d/types';

  interface Props {
    src: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
    validateLimits?: boolean;
    onLoad?: () => void;
    onError?: (error: Error) => void;
  }

  let {
    src,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    validateLimits = true,
    onLoad,
    onError,
  }: Props = $props();

  const { context } = getContext<{ context: import('$lib/3d/types').Scene3DContext | null }>('scene3d');
  let model: THREE.Group | null = $state(null);
  let loading = $state(true);

  // Load model when src changes
  $effect(() => {
    if (!context || !src) return;

    let cancelled = false;
    loading = true;

    loadGLTF(src, {}, validateLimits ? DEFAULT_LIMITS : undefined)
      .then((loaded) => {
        if (cancelled) return;

        // Remove previous model
        if (model) {
          context.scene.remove(model);
        }

        model = loaded;
        context.scene.add(model);
        loading = false;
        onLoad?.();
        context.requestRender();
      })
      .catch((err) => {
        if (cancelled) return;
        loading = false;
        onError?.(err);
      });

    return () => {
      cancelled = true;
      if (model) {
        context.scene.remove(model);
        model = null;
      }
    };
  });

  // Update transform when props change
  $effect(() => {
    if (!model || !context) return;

    model.position.set(...position);
    model.rotation.set(...rotation);

    if (typeof scale === 'number') {
      model.scale.setScalar(scale);
    } else {
      model.scale.set(...scale);
    }

    context.requestRender();
  });
</script>

<!-- No DOM output, this is a scene graph component -->
```

**`src/lib/components/3d/OrbitControls.svelte`**
```svelte
<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  interface Props {
    enableDamping?: boolean;
    dampingFactor?: number;
    enableZoom?: boolean;
    enablePan?: boolean;
    autoRotate?: boolean;
    autoRotateSpeed?: number;
  }

  let {
    enableDamping = true,
    dampingFactor = 0.05,
    enableZoom = true,
    enablePan = true,
    autoRotate = false,
    autoRotateSpeed = 2,
  }: Props = $props();

  const { context } = getContext<{ context: import('$lib/3d/types').Scene3DContext | null }>('scene3d');

  onMount(() => {
    if (!context) return;

    const controls = new OrbitControls(context.camera, context.renderer.domElement);
    controls.enableDamping = enableDamping;
    controls.dampingFactor = dampingFactor;
    controls.enableZoom = enableZoom;
    controls.enablePan = enablePan;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = autoRotateSpeed;

    controls.addEventListener('change', () => context.requestRender());

    // Animation loop for damping/autoRotate
    let animating = enableDamping || autoRotate;
    let frameId: number;

    function animate() {
      if (!animating) return;
      controls.update();
      context.requestRender();
      frameId = requestAnimationFrame(animate);
    }

    if (animating) animate();

    return () => {
      animating = false;
      cancelAnimationFrame(frameId);
      controls.dispose();
    };
  });
</script>
```

### 1.4 Create Showcase Route

**`src/routes/showcase/3d/+page.svelte`**
```svelte
<script lang="ts">
  import Canvas from '$lib/components/3d/Canvas.svelte';
  import Model from '$lib/components/3d/Model.svelte';
  import OrbitControls from '$lib/components/3d/OrbitControls.svelte';

  let loading = $state(true);
  let error = $state<string | null>(null);

  // Accessibility: respect reduced motion
  let prefersReducedMotion = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => prefersReducedMotion = e.matches;
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });
</script>

<svelte:head>
  <title>3D Viewer | Velociraptor</title>
</svelte:head>

<div class="p-6">
  <h1 class="text-2xl font-bold mb-4">3D Model Viewer</h1>

  <div
    class="relative w-full aspect-video bg-dark-800 rounded-lg overflow-hidden"
    role="img"
    aria-label="Interactive 3D model viewer"
  >
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-gray-400">Loading model...</span>
      </div>
    {/if}

    {#if error}
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-red-400">{error}</span>
      </div>
    {/if}

    <Canvas>
      <Model
        src="/models/sample.glb"
        onLoad={() => loading = false}
        onError={(e) => { loading = false; error = e.message; }}
      />
      <OrbitControls autoRotate={!prefersReducedMotion} />
    </Canvas>
  </div>

  <div class="mt-4 text-sm text-gray-500">
    <p>Drag to rotate • Scroll to zoom • Shift+drag to pan</p>
  </div>
</div>

<style>
  /* Prevent canvas from capturing all pointer events when loading */
  :global(canvas) {
    touch-action: none;
  }
</style>
```

---

## Phase 2: Pipeline

Upload, processing, and storage infrastructure.

### 2.1 Database Schema

Run migration after adding to schema file:

```bash
# In container
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

### 2.2 Upload API

**`src/routes/api/models/upload/+server.ts`**
```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateModelFile, getFileStats } from '$lib/server/3d/validation';
import { uploadToR2 } from '$lib/server/storage/r2';
import { db } from '$lib/server/db';
import { models3d } from '$lib/server/db/schema/models3d';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  const formData = await request.formData();
  const file = formData.get('model') as File | null;
  const name = formData.get('name') as string;

  if (!file) {
    throw error(400, 'No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw error(413, `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file format (magic bytes, not MIME)
  const buffer = await file.arrayBuffer();
  const validation = await validateModelFile(buffer);

  if (!validation.valid) {
    throw error(415, validation.error || 'Invalid file format');
  }

  // Get model statistics
  const stats = await getFileStats(buffer);

  // Generate content-addressable key
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const storageKey = `models/${hashHex}/model.glb`;

  // Upload to R2
  await uploadToR2(storageKey, buffer, 'model/gltf-binary');

  // Create database record
  const [model] = await db.insert(models3d).values({
    userId: locals.user.id,
    name: name || file.name.replace(/\.glb?$/i, ''),
    slug: hashHex.slice(0, 12),
    format: 'glb',
    status: 'ready',
    polyCount: stats.triangles,
    vertexCount: stats.vertices,
    fileSize: file.size,
    storageKey,
  }).returning();

  return json({ id: model.id, slug: model.slug });
};
```

### 2.3 File Validation

**`src/lib/server/3d/validation.ts`**
```typescript
export interface ValidationResult {
  valid: boolean;
  detectedType: string | null;
  error?: string;
}

// GLB magic bytes: "glTF" (0x67 0x6C 0x54 0x46)
const GLB_MAGIC = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);

export async function validateModelFile(buffer: ArrayBuffer): Promise<ValidationResult> {
  const header = new Uint8Array(buffer.slice(0, 12));

  // Check GLB magic bytes
  const isGLB = GLB_MAGIC.every((byte, i) => header[i] === byte);

  if (isGLB) {
    // Validate GLB version (should be 2)
    const version = new DataView(buffer).getUint32(4, true);
    if (version !== 2) {
      return { valid: false, detectedType: null, error: `Unsupported glTF version: ${version}` };
    }
    return { valid: true, detectedType: 'model/gltf-binary' };
  }

  // Check for JSON-based glTF (starts with '{')
  if (header[0] === 0x7b) {
    return { valid: false, detectedType: null, error: 'JSON glTF not supported. Please export as GLB (binary).' };
  }

  return { valid: false, detectedType: null, error: 'Unrecognized file format. Expected GLB.' };
}

export async function getFileStats(buffer: ArrayBuffer): Promise<{ vertices: number; triangles: number }> {
  // Parse GLB to count vertices/triangles
  // This is a simplified version - full implementation would parse the JSON chunk
  const dataView = new DataView(buffer);
  const jsonChunkLength = dataView.getUint32(12, true);
  const jsonChunk = new TextDecoder().decode(buffer.slice(20, 20 + jsonChunkLength));

  try {
    const gltf = JSON.parse(jsonChunk);
    let vertices = 0;
    let triangles = 0;

    // Count from accessors
    for (const mesh of gltf.meshes || []) {
      for (const primitive of mesh.primitives || []) {
        if (primitive.attributes?.POSITION !== undefined) {
          const accessor = gltf.accessors[primitive.attributes.POSITION];
          vertices += accessor.count;
        }
        if (primitive.indices !== undefined) {
          const accessor = gltf.accessors[primitive.indices];
          triangles += accessor.count / 3;
        }
      }
    }

    return { vertices, triangles };
  } catch {
    return { vertices: 0, triangles: 0 };
  }
}
```

---

## Phase 3: Polish

UX improvements, accessibility, and performance optimization.

### 3.1 Loading States

```svelte
<script lang="ts">
  let progress = $state(0);
</script>

{#if progress < 1}
  <div class="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/80">
    <div class="w-48 h-2 bg-dark-700 rounded-full overflow-hidden">
      <div
        class="h-full bg-primary-500 transition-all duration-200"
        style="width: {progress * 100}%"
      ></div>
    </div>
    <span class="mt-2 text-sm text-gray-400">{Math.round(progress * 100)}%</span>
  </div>
{/if}
```

### 3.2 Accessibility

```svelte
<script lang="ts">
  let paused = $state(false);
</script>

<div role="application" aria-label="3D model viewer">
  <Canvas>
    <OrbitControls autoRotate={!paused && !prefersReducedMotion} />
  </Canvas>

  <div class="absolute bottom-4 right-4 flex gap-2">
    <button
      onclick={() => paused = !paused}
      aria-label={paused ? 'Resume rotation' : 'Pause rotation'}
      class="p-2 bg-dark-800 rounded"
    >
      {paused ? '▶' : '⏸'}
    </button>
  </div>

  <!-- Screen reader description -->
  <div class="sr-only">
    Interactive 3D model. Use mouse or touch to rotate, scroll to zoom.
  </div>
</div>
```

### 3.3 Error Boundaries

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let webglSupported = $state(true);

  onMount(() => {
    const canvas = document.createElement('canvas');
    webglSupported = !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  });
</script>

{#if !webglSupported}
  <div class="p-8 text-center">
    <p class="text-lg text-gray-400">
      3D viewing requires WebGL support.
    </p>
    <p class="mt-2 text-sm text-gray-500">
      Please try a different browser or enable hardware acceleration.
    </p>
  </div>
{:else}
  <Canvas>
    <!-- 3D content -->
  </Canvas>
{/if}
```

---

## Phase 4: Enhancement

Advanced features for future iterations.

### 4.1 WebGPU Renderer

When browser support reaches 80%+:

```typescript
// Feature detection
const supportsWebGPU = 'gpu' in navigator;

// Conditional renderer
const renderer = supportsWebGPU
  ? await createWebGPURenderer(canvas)
  : createWebGLRenderer(canvas);
```

### 4.2 AR Quick Look (iOS)

```svelte
{#if /iPhone|iPad/.test(navigator.userAgent)}
  <a
    rel="ar"
    href={usdzUrl}
    class="btn btn-primary"
  >
    View in AR
  </a>
{/if}
```

### 4.3 Model Annotations

Clickable hotspots with information overlays:

```typescript
interface Annotation {
  id: string;
  position: [number, number, number];
  title: string;
  description: string;
}

// Raycasting for click detection
function onCanvasClick(event: MouseEvent) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(annotationSprites);
  if (intersects.length > 0) {
    showAnnotation(intersects[0].object.userData.annotation);
  }
}
```

---

## Checklist

### Phase 1: Foundation
- [ ] Add dependencies to `package.json`
- [ ] Restart container
- [ ] Create `$lib/3d/types.ts`
- [ ] Create `$lib/3d/engine/scene.ts`
- [ ] Create `$lib/3d/engine/loader.ts`
- [ ] Create `$lib/3d/engine/limits.ts`
- [ ] Create `$lib/components/3d/Canvas.svelte`
- [ ] Create `$lib/components/3d/Model.svelte`
- [ ] Create `$lib/components/3d/OrbitControls.svelte`
- [ ] Create `/showcase/3d/+page.svelte`
- [ ] Add sample GLB model to `/static/models/`
- [ ] Test basic rendering
- [ ] Configure Vite chunking

### Phase 2: Pipeline
- [ ] Add `models_3d` schema
- [ ] Run migrations
- [ ] Create upload API endpoint
- [ ] Create file validation utilities
- [ ] Implement R2 storage integration
- [ ] Create model gallery page
- [ ] Create model detail page with viewer

### Phase 3: Polish
- [ ] Add loading progress indicator
- [ ] Add error boundaries
- [ ] Implement reduced motion support
- [ ] Add keyboard controls
- [ ] Add ARIA labels and screen reader support
- [ ] Performance profiling
- [ ] Bundle size verification

### Phase 4: Enhancement
- [ ] WebGPU progressive enhancement
- [ ] AR Quick Look for iOS
- [ ] Model annotations system
- [ ] LOD generation pipeline
- [ ] Thumbnail generation
