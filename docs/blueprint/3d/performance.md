# 3D Performance

Performance targets, metrics, and optimization strategies for 3D visualization.

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **FCP** (First Contentful Paint) | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **TTFB** (Time to First Byte) | ≤ 800ms | ≤ 1800ms | > 1800ms |

### 3D-Specific Targets

| Metric | Target | Acceptable | Maximum |
|--------|--------|------------|---------|
| Initial bundle (gzip) | < 170KB | < 200KB | 250KB |
| 3D chunk (gzip) | < 200KB | < 250KB | 300KB |
| Model load time | < 2s | < 4s | 8s |
| Time to interactive | < 3s | < 5s | 8s |
| Desktop FPS | 60 | 45 | 30 min |
| Mobile FPS | 30 | 24 | 20 min |
| Draw calls/frame | < 50 | < 100 | 200 max |
| GPU memory | < 256MB | < 512MB | 1GB max |

---

## Bundle Optimization

### Code Splitting Strategy

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],

  optimizeDeps: {
    // Pre-bundle heavy dependencies
    include: ['three'],
    // Don't pre-bundle - let Vite handle tree-shaking
    exclude: ['@threlte/core', '@threlte/extras'],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js core (largest chunk)
          if (id.includes('node_modules/three/build')) {
            return 'three-core';
          }

          // Three.js loaders (loaded on demand)
          if (id.includes('node_modules/three/examples/jsm/loaders')) {
            return 'three-loaders';
          }

          // Three.js controls
          if (id.includes('node_modules/three/examples/jsm/controls')) {
            return 'three-controls';
          }

          // Threlte (Svelte bindings)
          if (id.includes('@threlte')) {
            return 'threlte';
          }

          // Draco decoder (WASM)
          if (id.includes('draco')) {
            return 'draco';
          }
        },
      },
    },

    // Warn on large chunks
    chunkSizeWarningLimit: 300,
  },
});
```

### Expected Chunk Sizes

| Chunk | Raw | Gzip | Brotli |
|-------|-----|------|--------|
| three-core | ~650KB | ~180KB | ~150KB |
| three-loaders | ~120KB | ~35KB | ~30KB |
| three-controls | ~25KB | ~8KB | ~7KB |
| threlte | ~45KB | ~15KB | ~12KB |
| draco (WASM) | ~300KB | ~100KB | ~85KB |

### Dynamic Imports

Only load 3D code when needed:

```svelte
<!-- src/routes/showcase/3d/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let Canvas: typeof import('$lib/components/3d/Canvas.svelte').default;
  let Model: typeof import('$lib/components/3d/Model.svelte').default;
  let loaded = $state(false);

  onMount(async () => {
    // Parallel dynamic imports
    const [canvasMod, modelMod] = await Promise.all([
      import('$lib/components/3d/Canvas.svelte'),
      import('$lib/components/3d/Model.svelte'),
    ]);

    Canvas = canvasMod.default;
    Model = modelMod.default;
    loaded = true;
  });
</script>

{#if loaded}
  <Canvas>
    <Model src="/models/sample.glb" />
  </Canvas>
{:else}
  <div class="skeleton w-full aspect-video" />
{/if}
```

---

## Rendering Optimization

### On-Demand Rendering

Default for static models. Only render when state changes.

```typescript
// $lib/3d/engine/scene.ts
export function createOnDemandRenderer(renderer: THREE.WebGLRenderer) {
  let frameRequested = false;

  function render() {
    frameRequested = false;
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (!frameRequested) {
      frameRequested = true;
      requestAnimationFrame(render);
    }
  }

  // Trigger render on:
  // - Camera movement
  // - Model load
  // - Prop changes
  // - Window resize

  return { requestRender };
}
```

### Continuous Rendering

Only when animations are playing:

```typescript
function createAnimationLoop() {
  let running = false;
  let frameId: number;

  function loop() {
    if (!running) return;

    // Update animations
    mixer?.update(clock.getDelta());

    // Render
    renderer.render(scene, camera);

    frameId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    loop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  return { start, stop };
}
```

### Frame Budget

Target: 16.67ms per frame (60 FPS).

| Phase | Budget | Typical |
|-------|--------|---------|
| JavaScript | 5ms | Input, state updates |
| Layout/Style | 2ms | DOM updates |
| Paint | 2ms | 2D rendering |
| WebGL | 7ms | 3D rendering |
| Buffer | 1ms | Safety margin |

### Draw Call Optimization

```typescript
// Merge geometries where possible
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function optimizeScene(scene: THREE.Scene) {
  const meshes: THREE.Mesh[] = [];

  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.material === sharedMaterial) {
      meshes.push(obj);
    }
  });

  if (meshes.length > 1) {
    const geometries = meshes.map(m => m.geometry);
    const merged = mergeGeometries(geometries);
    const mergedMesh = new THREE.Mesh(merged, sharedMaterial);

    // Remove original meshes
    meshes.forEach(m => m.removeFromParent());

    // Add merged mesh
    scene.add(mergedMesh);
  }
}
```

### Instancing

For repeated objects (trees, particles, etc.):

```typescript
const instanceCount = 1000;
const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Euler();
const scale = new THREE.Vector3(1, 1, 1);

for (let i = 0; i < instanceCount; i++) {
  position.set(Math.random() * 100, 0, Math.random() * 100);
  rotation.set(0, Math.random() * Math.PI * 2, 0);

  matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
  mesh.setMatrixAt(i, matrix);
}

mesh.instanceMatrix.needsUpdate = true;
scene.add(mesh);
```

---

## Model Optimization

### Level of Detail (LOD)

```typescript
import * as THREE from 'three';

const lod = new THREE.LOD();

// High detail (0-5 meters)
const high = await loadGLTF('/models/model-lod0.glb');
lod.addLevel(high, 0);

// Medium detail (5-15 meters)
const medium = await loadGLTF('/models/model-lod1.glb');
lod.addLevel(medium, 5);

// Low detail (15+ meters)
const low = await loadGLTF('/models/model-lod2.glb');
lod.addLevel(low, 15);

scene.add(lod);

// Update in render loop
lod.update(camera);
```

### Polygon Budget by Category

| Category | Triangles | Use Case |
|----------|-----------|----------|
| Hero model | 50-100K | Main focus, detailed view |
| Secondary | 10-30K | Supporting elements |
| Background | 1-5K | Distant objects |
| UI elements | < 1K | Icons, indicators |

### Texture Optimization

| Size | Memory | Use Case |
|------|--------|----------|
| 4096×4096 | 64MB | Hero textures (desktop only) |
| 2048×2048 | 16MB | Standard models |
| 1024×1024 | 4MB | Secondary objects |
| 512×512 | 1MB | Small/distant objects |

```typescript
// Limit texture size based on device
function getMaxTextureSize(): number {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  const gl = document.createElement('canvas').getContext('webgl2');

  if (!gl) return 1024;

  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  if (isMobile) {
    return Math.min(maxSize, 2048);
  }

  return Math.min(maxSize, 4096);
}
```

---

## Memory Management

### Texture Disposal

```typescript
function disposeTexture(texture: THREE.Texture) {
  texture.dispose();

  // For video textures
  if (texture instanceof THREE.VideoTexture) {
    const video = texture.image as HTMLVideoElement;
    video.pause();
    video.src = '';
    video.load();
  }
}
```

### Geometry Disposal

```typescript
function disposeGeometry(geometry: THREE.BufferGeometry) {
  geometry.dispose();

  // Explicitly dispose attributes
  for (const key of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[key];
    if (attr.array) {
      // Help GC by nullifying large arrays
      (attr as any).array = null;
    }
  }
}
```

### Scene Cleanup

```typescript
function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      // Dispose geometry
      if (object.geometry) {
        disposeGeometry(object.geometry);
      }

      // Dispose materials
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        // Dispose textures
        for (const key of Object.keys(material)) {
          const value = (material as any)[key];
          if (value instanceof THREE.Texture) {
            disposeTexture(value);
          }
        }
        material.dispose();
      }
    }
  });

  scene.clear();
}
```

### Memory Monitoring

```typescript
// Check WebGL memory usage
function getGPUMemoryInfo(): { used: number; total: number } | null {
  const gl = renderer.getContext() as WebGL2RenderingContext;

  // WEBGL_memory_info extension (Chrome only)
  const ext = gl.getExtension('WEBGL_memory_info') as any;

  if (ext) {
    return {
      used: ext.GPU_MEMORY_INFO_CURRENT_AVAILABLE_VIDMEM_NVX,
      total: ext.GPU_MEMORY_INFO_TOTAL_AVAILABLE_MEMORY_NVX,
    };
  }

  return null;
}

// Three.js memory stats
function getThreeMemoryInfo() {
  return renderer.info.memory;
  // { geometries: number, textures: number }
}
```

---

## Loading Optimization

### Progressive Loading

Show low-res preview while loading full model:

```typescript
async function loadWithPreview(
  previewUrl: string,
  fullUrl: string,
  onProgress: (stage: string, progress: number) => void
): Promise<THREE.Group> {
  // Load preview immediately
  onProgress('preview', 0);
  const preview = await loadGLTF(previewUrl);
  scene.add(preview);
  onProgress('preview', 1);

  // Load full model in background
  onProgress('full', 0);
  const full = await loadGLTF(fullUrl, {
    onProgress: (p) => onProgress('full', p),
  });

  // Swap when ready
  scene.remove(preview);
  disposeObject(preview);
  scene.add(full);
  onProgress('full', 1);

  return full;
}
```

### Preloading

Preload models on link hover:

```svelte
<script lang="ts">
  import { preloadGLTF } from '$lib/3d/engine/loader';

  function handleMouseEnter(modelUrl: string) {
    // Start loading on hover
    preloadGLTF(modelUrl);
  }
</script>

<a
  href="/models/{model.slug}"
  onmouseenter={() => handleMouseEnter(model.url)}
>
  {model.name}
</a>
```

### Parallel Loading

Load model + textures in parallel:

```typescript
async function loadModelWithTextures(
  modelUrl: string,
  textureUrls: string[]
): Promise<{ model: THREE.Group; textures: THREE.Texture[] }> {
  const [model, ...textures] = await Promise.all([
    loadGLTF(modelUrl),
    ...textureUrls.map(url => textureLoader.loadAsync(url)),
  ]);

  return { model, textures };
}
```

---

## Device Adaptation

### Performance Tier Detection

```typescript
type PerformanceTier = 'high' | 'medium' | 'low';

function detectPerformanceTier(): PerformanceTier {
  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 4;

  // Check device memory (Chrome only)
  const memory = (navigator as any).deviceMemory || 4;

  // Check for mobile
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

  // Check WebGL capabilities
  const gl = document.createElement('canvas').getContext('webgl2');
  const maxTextureSize = gl?.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  const maxVertexUniforms = gl?.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 256;

  // Score calculation
  let score = 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
  score += isMobile ? 0 : 2;
  score += maxTextureSize >= 8192 ? 1 : 0;
  score += maxVertexUniforms >= 1024 ? 1 : 0;

  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}
```

### Settings by Tier

```typescript
const QUALITY_PRESETS = {
  high: {
    maxTextureSize: 4096,
    shadowMapSize: 2048,
    antialiasing: true,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    maxLights: 8,
    lodBias: 0,
  },
  medium: {
    maxTextureSize: 2048,
    shadowMapSize: 1024,
    antialiasing: true,
    pixelRatio: Math.min(window.devicePixelRatio, 1.5),
    maxLights: 4,
    lodBias: 1,
  },
  low: {
    maxTextureSize: 1024,
    shadowMapSize: 512,
    antialiasing: false,
    pixelRatio: 1,
    maxLights: 2,
    lodBias: 2,
  },
};
```

---

## Monitoring

### Performance Metrics Collection

```typescript
import { onCLS, onFCP, onLCP, onINP, onTTFB } from 'web-vitals';

// Collect Core Web Vitals
onLCP(console.log);
onFCP(console.log);
onINP(console.log);
onCLS(console.log);
onTTFB(console.log);

// 3D-specific metrics
function measure3DPerformance() {
  return {
    fps: renderer.info.render.frame,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}
```

### FPS Monitoring

```typescript
class FPSMonitor {
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;

  tick() {
    this.frames++;
    const now = performance.now();

    if (now - this.lastTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = now;

      // Warn if FPS drops
      if (this.fps < 30) {
        console.warn(`Low FPS: ${this.fps}`);
      }
    }

    return this.fps;
  }
}
```
