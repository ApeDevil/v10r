# 3D Web Integration

SvelteKit 2 + Svelte 5 patterns for integrating 3D experiences. Framework-first approach with progressive enhancement.

## Contents

- [Technology Options](#technology-options) - Threlte vs vanilla Three.js
- [Route Structure](#route-structure) - Where 3D pages live
- [Rendering Strategy](#rendering-strategy) - SSR vs CSR for 3D
- [Svelte 5 + 3D Patterns](#svelte-5--3d-patterns) - Runes with WebGL
- [Load Functions](#load-functions) - Asset metadata and preloading
- [Threlte Integration](#threlte-integration) - Declarative 3D with Svelte
- [Vanilla Three.js Integration](#vanilla-threejs-integration) - Direct Three.js usage
- [Performance Considerations](#performance-considerations) - Bundle size and loading
- [Progressive Enhancement](#progressive-enhancement) - Fallbacks for no-WebGL
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [Implementation Checklist](#implementation-checklist) - Setup steps

## Technology Options

| Approach | Bundle Size | Learning Curve | Flexibility | Best For |
|----------|-------------|----------------|-------------|----------|
| **Threlte 8** | Medium (Three.js + wrapper) | Low (Svelte-like) | High | Declarative scenes, rapid prototyping |
| **Vanilla Three.js** | Smaller (just Three.js) | Medium | Very High | Complex scenes, performance-critical |
| **drei-vanilla** | Medium | Low | Medium | Reusable helpers, standard patterns |

### Decision Framework

**Choose Threlte when:**
- You want Svelte reactivity in your 3D scene
- Component composition feels natural
- You're building UI-heavy 3D experiences
- You need rapid iteration

**Choose Vanilla Three.js when:**
- Bundle size is critical
- You need maximum performance control
- The scene is self-contained (limited reactivity)
- You have existing Three.js expertise

**Threlte + Svelte 5 Compatibility:**
- Threlte v8.3+ supports Svelte 5
- Use `@threlte/core@latest` for Svelte 5 projects
- Older Threlte v7 is Svelte 4 only (legacy)

## Route Structure

### Recommended Structure

```
src/routes/
  showcase/
    3d/
      +layout.svelte              # Shared 3D layout (dark theme, fullscreen option)
      +page.svelte                # 3D showcase landing/index
      basic-scene/+page.svelte    # Simple spinning cube
      gltf-viewer/+page.svelte    # Model viewer
      interactive/+page.svelte    # Click/hover interactions
      physics/+page.svelte        # Rapier physics demo
      shaders/+page.svelte        # Custom shaders

  experience/                     # Immersive 3D experiences
    +layout.svelte                # Minimal shell, no sidebar
    product/+page.svelte          # 3D product configurator
```

### Layout Considerations

**Showcase Layout** (`/showcase/3d/+layout.svelte`):
- Keep app shell (sidebar) visible
- Dark theme by default (better for 3D)
- Toggle fullscreen mode
- Show controls/help overlay

**Experience Layout** (`/experience/+layout.svelte`):
- Remove sidebar (immersive)
- Full viewport canvas
- Minimal UI chrome
- Exit button prominent

```svelte
<!-- /showcase/3d/+layout.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  let fullscreen = $state(false);
  let showControls = $state(true);
</script>

<div class="showcase-3d" class:fullscreen>
  {#if showControls}
    <div class="controls-overlay">
      <button onclick={() => fullscreen = !fullscreen}>
        {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
      <details>
        <summary>Controls</summary>
        <ul>
          <li>Left click + drag: Rotate</li>
          <li>Right click + drag: Pan</li>
          <li>Scroll: Zoom</li>
        </ul>
      </details>
    </div>
  {/if}

  <slot />
</div>

<style>
  .showcase-3d {
    position: relative;
    height: calc(100vh - var(--header-height));
    background: #000;
  }

  .fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1000;
    height: 100vh;
  }

  .controls-overlay {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    background: rgba(0, 0, 0, 0.7);
    padding: 1rem;
    border-radius: 0.5rem;
  }
</style>
```

## Rendering Strategy

### CSR-Only for 3D Pages

**3D pages must disable SSR** because:
1. Three.js requires `window`, `document`, `canvas` - not available on server
2. WebGL context cannot be created server-side
3. Heavy bundle should only ship to browser

```typescript
// +page.ts or +page.server.ts
export const ssr = false;
export const prerender = false; // 3D is interactive, not static
```

### Conditional Imports

**Always use dynamic imports for Three.js** to avoid SSR errors:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let sceneContainer = $state<HTMLDivElement>();

  onMount(async () => {
    if (!browser) return;

    // Dynamic import - only runs in browser
    const THREE = await import('three');
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

    // Initialize scene here
    const scene = new THREE.Scene();
    // ...
  });
</script>

{#if browser}
  <div bind:this={sceneContainer}></div>
{:else}
  <div class="loading">Loading 3D scene...</div>
{/if}
```

### Why Not `if (browser) { import() }`?

```svelte
<!-- WRONG: Still evaluated at build time -->
<script lang="ts">
  import { browser } from '$app/environment';

  if (browser) {
    import * as THREE from 'three'; // ❌ Fails SSR build
  }
</script>

<!-- RIGHT: Dynamic import inside function -->
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    const THREE = await import('three'); // ✅ Only runs in browser
  });
</script>
```

## Svelte 5 + 3D Patterns

### Scene State with Runes

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type * as THREE from 'three';

  // Reactive scene state
  let rotation = $state({ x: 0, y: 0, z: 0 });
  let cameraPosition = $state({ x: 0, y: 0, z: 5 });
  let isAnimating = $state(true);

  // Derived values
  let rotationSpeed = $derived(isAnimating ? 0.01 : 0);

  // Scene references (not reactive - WebGL objects)
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let cube: THREE.Mesh;

  // Update Three.js from reactive state
  $effect(() => {
    if (!cube) return;
    cube.rotation.x = rotation.x;
    cube.rotation.y = rotation.y;
    cube.rotation.z = rotation.z;
  });

  $effect(() => {
    if (!camera) return;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
  });

  onMount(async () => {
    const THREE = await import('three');

    // Initialize scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });

    // Create geometry
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      if (isAnimating) {
        rotation.y += rotationSpeed;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  });
</script>

<div>
  <canvas bind:this={renderer?.domElement}></canvas>

  <div class="controls">
    <label>
      <input type="checkbox" bind:checked={isAnimating} />
      Animate
    </label>

    <label>
      Rotation Y:
      <input type="range" min="0" max={Math.PI * 2} step="0.1" bind:value={rotation.y} />
    </label>
  </div>
</div>
```

### Cleanup Pattern with $effect

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let animationFrameId = $state<number>();

  // Cleanup on unmount
  $effect(() => {
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Dispose WebGL resources
      renderer?.dispose();
      scene?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  });
</script>
```

**Key Pattern:** Return cleanup function from `$effect` to ensure proper disposal.

### Reactive Camera/Controls

```svelte
<script lang="ts">
  import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  let controls: OrbitControls;
  let enableRotate = $state(true);
  let enableZoom = $state(true);
  let enablePan = $state(true);

  // Update controls reactively
  $effect(() => {
    if (!controls) return;
    controls.enableRotate = enableRotate;
    controls.enableZoom = enableZoom;
    controls.enablePan = enablePan;
    controls.update();
  });

  onMount(async () => {
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    controls = new OrbitControls(camera, renderer.domElement);

    return () => {
      controls.dispose();
    };
  });
</script>

<div class="controls">
  <label><input type="checkbox" bind:checked={enableRotate} /> Rotate</label>
  <label><input type="checkbox" bind:checked={enableZoom} /> Zoom</label>
  <label><input type="checkbox" bind:checked={enablePan} /> Pan</label>
</div>
```

## Load Functions

### Preloading Asset Metadata

```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Load model metadata from database or file system
  const models = [
    {
      id: 'robot',
      name: 'Robot Character',
      url: '/models/robot.glb',
      size: 2.3, // MB
      polyCount: 50000,
      thumbnail: '/thumbnails/robot.jpg'
    },
    {
      id: 'car',
      name: 'Sports Car',
      url: '/models/car.glb',
      size: 4.1,
      polyCount: 120000,
      thumbnail: '/thumbnails/car.jpg'
    }
  ];

  return { models };
};
```

### Streaming Large Assets

```typescript
// +page.server.ts
export const load: PageServerLoad = async () => {
  return {
    // Instant: small metadata
    models: getModelList(),

    // Streamed: large model data
    modelDetails: fetchModelDetails(), // Returns Promise
  };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<!-- Instant: show list -->
<ul>
  {#each data.models as model}
    <li>{model.name}</li>
  {/each}
</ul>

<!-- Streamed: show when ready -->
{#await data.modelDetails}
  <p>Loading model details...</p>
{:then details}
  <ModelViewer {details} />
{/await}
```

### Error Handling

```typescript
// +page.server.ts
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
  const model = await db.models.findUnique({
    where: { id: params.id }
  });

  if (!model) {
    error(404, { message: 'Model not found' });
  }

  // Validate file exists
  const fileExists = await checkFileExists(model.url);
  if (!fileExists) {
    error(500, { message: 'Model file missing' });
  }

  return { model };
};
```

## Threlte Integration

### Installation

```bash
# Add to package.json, then restart container
{
  "dependencies": {
    "@threlte/core": "^8.3.1",
    "@threlte/extras": "^9.0.0",
    "@threlte/rapier": "^2.0.0",
    "three": "^0.170.0"
  }
}
```

### Basic Scene

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import Scene from './Scene.svelte';
</script>

<div class="canvas-container">
  <Canvas>
    <Scene />
    <OrbitControls />
  </Canvas>
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100vh;
  }
</style>
```

```svelte
<!-- Scene.svelte -->
<script lang="ts">
  import { T } from '@threlte/core';
  import { useFrame } from '@threlte/core';

  let rotation = $state(0);

  // Threlte's useFrame hook
  useFrame((state, delta) => {
    rotation += delta;
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 5]} />

<T.DirectionalLight position={[5, 10, 5]} intensity={1} />
<T.AmbientLight intensity={0.5} />

<T.Mesh rotation.y={rotation}>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshStandardMaterial color="hotpink" />
</T.Mesh>
```

### Reactive Props with Threlte

```svelte
<script lang="ts">
  import { T } from '@threlte/core';

  let color = $state('#ff0000');
  let metalness = $state(0.5);
  let roughness = $state(0.5);
</script>

<T.Mesh>
  <T.SphereGeometry args={[1, 32, 32]} />
  <T.MeshStandardMaterial
    {color}
    {metalness}
    {roughness}
  />
</T.Mesh>

<div class="controls">
  <input type="color" bind:value={color} />
  <label>Metalness: <input type="range" min="0" max="1" step="0.1" bind:value={metalness} /></label>
  <label>Roughness: <input type="range" min="0" max="1" step="0.1" bind:value={roughness} /></label>
</div>
```

### GLTF Model Loading

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { GLTF } from '@threlte/extras';
  import { page } from '$app/state';

  let { data } = $props();
  let scale = $state(1);
</script>

<GLTF
  url={data.model.url}
  {scale}
  position={[0, 0, 0]}
/>

<label>
  Scale:
  <input type="range" min="0.1" max="3" step="0.1" bind:value={scale} />
</label>
```

### Threlte + Physics (Rapier)

```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { World, RigidBody, Collider } from '@threlte/rapier';
</script>

<Canvas>
  <World gravity={[0, -9.81, 0]}>
    <!-- Static ground -->
    <RigidBody type="fixed">
      <Collider shape="cuboid" args={[10, 0.5, 10]} />
      <T.Mesh position={[0, -0.5, 0]}>
        <T.BoxGeometry args={[20, 1, 20]} />
        <T.MeshStandardMaterial color="gray" />
      </T.Mesh>
    </RigidBody>

    <!-- Dynamic falling cube -->
    <RigidBody type="dynamic">
      <Collider shape="cuboid" args={[0.5, 0.5, 0.5]} />
      <T.Mesh position={[0, 5, 0]}>
        <T.BoxGeometry args={[1, 1, 1]} />
        <T.MeshStandardMaterial color="red" />
      </T.Mesh>
    </RigidBody>
  </World>
</Canvas>
```

## Vanilla Three.js Integration

### Basic Setup

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import type * as THREE from 'three';

  let container = $state<HTMLDivElement>();
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;

  onMount(async () => {
    if (!browser || !container) return;

    const THREE = await import('three');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container?.removeChild(renderer.domElement);
    };
  });
</script>

{#if browser}
  <div bind:this={container} class="scene-container"></div>
{:else}
  <div class="loading">Loading 3D scene...</div>
{/if}

<style>
  .scene-container {
    width: 100%;
    height: 100vh;
  }
</style>
```

### GLTF Model Loading

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

  let { data } = $props();
  let loadingProgress = $state(0);
  let error = $state<string>();

  onMount(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');

    const loader = new GLTFLoader();

    // Optional: Draco compression support
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      data.model.url,

      // onLoad
      (gltf: GLTF) => {
        scene.add(gltf.scene);
        loadingProgress = 100;
      },

      // onProgress
      (xhr) => {
        loadingProgress = (xhr.loaded / xhr.total) * 100;
      },

      // onError
      (err) => {
        console.error('Error loading model:', err);
        error = 'Failed to load 3D model';
      }
    );
  });
</script>

{#if error}
  <div class="error">{error}</div>
{:else if loadingProgress < 100}
  <div class="loading">Loading model... {loadingProgress.toFixed(0)}%</div>
{/if}
```

### OrbitControls

```svelte
<script lang="ts">
  onMount(async () => {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

    // ... scene setup ...

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 20;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update(); // Required with damping
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      controls.dispose();
    };
  });
</script>
```

## Performance Considerations

### Bundle Size Optimization

**Three.js is large** (~600 KB minified). Optimize imports:

```typescript
// ❌ WRONG: Imports entire library
import * as THREE from 'three';

// ✅ BETTER: Import only what you need
import { Scene, PerspectiveCamera, WebGLRenderer, BoxGeometry, MeshStandardMaterial, Mesh } from 'three';
```

**Threlte adds wrapper overhead:**
- `@threlte/core`: ~50 KB
- `@threlte/extras`: ~100 KB (helpers)
- `@threlte/rapier`: ~200 KB + WASM

**Lazy load 3D pages:**

```typescript
// +layout.ts (parent)
export const load = async () => {
  // Don't import 3D libs here - keep them in child routes
  return {};
};
```

### Code Splitting

```svelte
<!-- Lazy load heavy 3D components -->
<script lang="ts">
  import { onMount } from 'svelte';

  let ModelViewer: any;

  onMount(async () => {
    ModelViewer = (await import('$lib/components/ModelViewer.svelte')).default;
  });
</script>

{#if ModelViewer}
  <svelte:component this={ModelViewer} />
{/if}
```

### Asset Optimization

1. **Use GLTF/GLB** (not OBJ/FBX) - efficient binary format
2. **Enable Draco compression** - 90% size reduction
3. **Optimize textures** - Use compressed formats (Basis/KTX2)
4. **LOD (Level of Detail)** - Multiple quality levels
5. **Lazy load models** - Load on interaction, not page load

### Memory Management

```svelte
<script lang="ts">
  onMount(() => {
    // ... scene setup ...

    return () => {
      // Dispose ALL WebGL resources
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();

          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      renderer.forceContextLoss();
    };
  });
</script>
```

## Progressive Enhancement

### WebGL Detection

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let hasWebGL = $state<boolean>();

  function detectWebGL(): boolean {
    if (!browser) return false;

    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  onMount(() => {
    hasWebGL = detectWebGL();
  });
</script>

{#if hasWebGL === false}
  <div class="fallback">
    <h2>WebGL Not Supported</h2>
    <p>Your browser doesn't support WebGL, which is required for 3D experiences.</p>
    <img src={data.model.thumbnail} alt="Model preview" />
  </div>
{:else if hasWebGL === true}
  <Canvas>
    <Scene />
  </Canvas>
{:else}
  <div class="loading">Checking WebGL support...</div>
{/if}
```

### Static Fallbacks

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ params }) => {
  const model = await getModel(params.id);

  return {
    model,
    // Fallback content
    screenshots: await getModelScreenshots(params.id),
    description: model.description,
    specs: {
      polyCount: model.polyCount,
      vertexCount: model.vertexCount,
      materials: model.materials.length
    }
  };
};
```

```svelte
<!-- Show static content if WebGL unavailable -->
{#if !hasWebGL}
  <div class="model-info">
    <h1>{data.model.name}</h1>
    <p>{data.model.description}</p>

    <div class="screenshots">
      {#each data.screenshots as screenshot}
        <img src={screenshot.url} alt={screenshot.caption} />
      {/each}
    </div>

    <dl class="specs">
      <dt>Polygon Count</dt>
      <dd>{data.specs.polyCount.toLocaleString()}</dd>

      <dt>Vertex Count</dt>
      <dd>{data.specs.vertexCount.toLocaleString()}</dd>
    </dl>
  </div>
{/if}
```

### Performance Tiers

```svelte
<script lang="ts">
  let quality = $state<'low' | 'medium' | 'high'>('medium');

  onMount(() => {
    // Detect device capabilities
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const hasLowMemory = (navigator as any).deviceMemory < 4;

    if (isMobile || hasLowMemory) {
      quality = 'low';
    } else {
      quality = 'high';
    }
  });

  // Adjust scene based on quality
  $effect(() => {
    if (!renderer) return;

    switch (quality) {
      case 'low':
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        break;
      case 'medium':
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        break;
      case 'high':
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        break;
    }
  });
</script>

<div class="quality-selector">
  <label>
    <input type="radio" bind:group={quality} value="low" />
    Low (faster)
  </label>
  <label>
    <input type="radio" bind:group={quality} value="medium" />
    Medium
  </label>
  <label>
    <input type="radio" bind:group={quality} value="high" />
    High (prettier)
  </label>
</div>
```

## Anti-Patterns

### ❌ Don't Import Three.js at Top Level

```svelte
<!-- WRONG: Breaks SSR -->
<script lang="ts">
  import * as THREE from 'three';

  const scene = new THREE.Scene(); // Error: window not defined
</script>
```

```svelte
<!-- RIGHT: Dynamic import in browser -->
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    const THREE = await import('three');
    const scene = new THREE.Scene();
  });
</script>
```

### ❌ Don't Skip Cleanup

```svelte
<!-- WRONG: Memory leak -->
<script lang="ts">
  onMount(() => {
    const renderer = new THREE.WebGLRenderer();
    // ... no cleanup
  });
</script>
```

```svelte
<!-- RIGHT: Dispose resources -->
<script lang="ts">
  onMount(() => {
    const renderer = new THREE.WebGLRenderer();

    return () => {
      renderer.dispose();
      renderer.forceContextLoss();
    };
  });
</script>
```

### ❌ Don't Create Animation Loop in $effect

```svelte
<!-- WRONG: Multiple loops, no cleanup -->
<script lang="ts">
  let rotation = $state(0);

  $effect(() => {
    const animate = () => {
      rotation += 0.01;
      requestAnimationFrame(animate);
    };
    animate();
    // Missing: return cleanup function
  });
</script>
```

```svelte
<!-- RIGHT: Single loop in onMount with cleanup -->
<script lang="ts">
  let rotation = $state(0);

  onMount(() => {
    let animationId: number;

    const animate = () => {
      rotation += 0.01;
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animationId);
  });
</script>
```

### ❌ Don't Mix Threlte and Vanilla Three.js

```svelte
<!-- WRONG: Threlte expects declarative approach -->
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { onMount } from 'svelte';

  onMount(async () => {
    const THREE = await import('three');
    const scene = new THREE.Scene(); // Conflicts with Threlte's scene
  });
</script>

<Canvas>
  <!-- Threlte components here -->
</Canvas>
```

**Pick one approach per scene.** Don't mix Threlte's declarative API with imperative Three.js.

### ❌ Don't Enable SSR for 3D Routes

```typescript
// WRONG: Crashes on server
export const ssr = true; // Default
```

```typescript
// RIGHT: Disable SSR
export const ssr = false;
export const prerender = false;
```

## Implementation Checklist

### Basic 3D Page Setup

- [ ] Disable SSR in `+page.ts`: `export const ssr = false`
- [ ] Add dark theme to layout
- [ ] Use dynamic imports for Three.js
- [ ] Check `browser` before initializing
- [ ] Add loading state while scene initializes
- [ ] Implement WebGL detection
- [ ] Provide static fallback content
- [ ] Add cleanup in `onMount` return function

### Threlte Setup

- [ ] Install `@threlte/core`, `@threlte/extras`, `three`
- [ ] Create `<Canvas>` wrapper component
- [ ] Use `<T>` components for Three.js objects
- [ ] Add `<OrbitControls>` from `@threlte/extras`
- [ ] Configure lighting (`<T.DirectionalLight>`, `<T.AmbientLight>`)
- [ ] Use `useFrame` for animation loop
- [ ] Test scene with simple geometry

### Vanilla Three.js Setup

- [ ] Create scene container `<div>`
- [ ] Initialize `Scene`, `Camera`, `Renderer` in `onMount`
- [ ] Set up lighting (ambient + directional)
- [ ] Create animation loop with `requestAnimationFrame`
- [ ] Add resize handler for responsive canvas
- [ ] Implement cleanup (dispose geometry, materials, renderer)
- [ ] Add `OrbitControls` for interaction

### GLTF Model Loading

- [ ] Store model metadata in database
- [ ] Preload metadata in `+page.server.ts` load function
- [ ] Show loading progress (0-100%)
- [ ] Handle load errors with user-friendly message
- [ ] Configure Draco loader for compression
- [ ] Add model to scene on load success
- [ ] Center/scale model to fit viewport
- [ ] Provide thumbnail as fallback

### Performance Optimization

- [ ] Use named imports (not `import *`)
- [ ] Lazy load heavy components
- [ ] Implement quality tiers (low/medium/high)
- [ ] Optimize textures (compressed formats)
- [ ] Use LOD for complex models
- [ ] Monitor FPS and adjust quality
- [ ] Dispose all resources on unmount
- [ ] Use `renderer.forceContextLoss()` for full cleanup

### Progressive Enhancement

- [ ] Detect WebGL support on mount
- [ ] Show fallback UI if no WebGL
- [ ] Provide static screenshots
- [ ] Display model specs as text
- [ ] Add "Upgrade Browser" message for old browsers
- [ ] Test on mobile devices
- [ ] Test with WebGL disabled

### Accessibility

- [ ] Add `aria-label` to canvas
- [ ] Provide text description of scene
- [ ] Add keyboard controls (arrow keys)
- [ ] Show controls help overlay
- [ ] Support reduced motion preference
- [ ] Ensure color contrast for UI
- [ ] Test with screen reader

## Next Steps

1. **Create Showcase Route** - `/showcase/3d/+page.svelte` landing page
2. **Add Basic Scene** - `/showcase/3d/basic-scene/+page.svelte` spinning cube
3. **GLTF Viewer** - `/showcase/3d/gltf-viewer/+page.svelte` with file picker
4. **Interactive Demo** - Click/hover interactions, raycasting
5. **Physics Demo** - Threlte + Rapier falling objects
6. **Shader Playground** - Custom shaders with controls

## References

- **Threlte Docs**: https://threlte.xyz/docs
- **Three.js Docs**: https://threejs.org/docs
- **drei-vanilla**: https://github.com/pmndrs/drei-vanilla
- **Draco Compression**: https://github.com/google/draco
- **SvelteKit Docs**: https://kit.svelte.dev/docs
