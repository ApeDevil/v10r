# 3D Integration Quick Reference

Essential patterns for adding 3D to SvelteKit. Copy-paste starting points.

## Page Setup (REQUIRED)

Every 3D page needs:

```typescript
// +page.ts
export const ssr = false;        // REQUIRED: No server rendering
export const prerender = false;  // REQUIRED: Dynamic content
```

## Basic Vanilla Three.js Scene

```svelte
<!-- /showcase/3d/basic-scene/+page.svelte -->
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import type * as THREE from 'three';

  let container = $state<HTMLDivElement>();
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let cube: THREE.Mesh;

  onMount(async () => {
    if (!browser || !container) return;

    // Dynamic import (never at top level!)
    const THREE = await import('three');

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Add cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    camera.position.z = 5;

    // Animation loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();

    // REQUIRED: Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  });
</script>

{#if browser}
  <div bind:this={container} class="scene"></div>
{:else}
  <div class="loading">Loading 3D scene...</div>
{/if}

<style>
  .scene { width: 100%; height: 100vh; }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
</style>
```

## Basic Threlte Scene

```bash
# Add to package.json, restart container
{
  "dependencies": {
    "@threlte/core": "^8.3.1",
    "@threlte/extras": "^9.0.0",
    "three": "^0.170.0"
  }
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Scene from './Scene.svelte';
</script>

<Canvas>
  <Scene />
</Canvas>

<style>
  :global(canvas) { display: block; }
</style>
```

```svelte
<!-- Scene.svelte -->
<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { useFrame } from '@threlte/core';

  let rotation = $state(0);

  useFrame((state, delta) => {
    rotation += delta;
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 5]} />
<T.DirectionalLight position={[5, 10, 5]} />
<T.AmbientLight intensity={0.5} />

<T.Mesh rotation.y={rotation}>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color="hotpink" />
</T.Mesh>

<OrbitControls />
```

## Reactive Controls Pattern

```svelte
<script lang="ts">
  import type * as THREE from 'three';

  // Reactive state
  let color = $state('#ff0000');
  let wireframe = $state(false);

  let material: THREE.MeshStandardMaterial;

  // React to changes
  $effect(() => {
    if (!material) return;
    material.color.set(color);
    material.wireframe = wireframe;
    material.needsUpdate = true;
  });
</script>

<div class="controls">
  <label>
    Color: <input type="color" bind:value={color} />
  </label>
  <label>
    <input type="checkbox" bind:checked={wireframe} />
    Wireframe
  </label>
</div>
```

## GLTF Model Loading

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

  let { data } = $props();
  let progress = $state(0);
  let error = $state<string>();

  onMount(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

    const loader = new GLTFLoader();

    loader.load(
      data.model.url,
      (gltf: GLTF) => {
        scene.add(gltf.scene);
        progress = 100;
      },
      (xhr) => {
        progress = (xhr.loaded / xhr.total) * 100;
      },
      (err) => {
        error = 'Failed to load model';
      }
    );
  });
</script>

{#if error}
  <div class="error">{error}</div>
{:else if progress < 100}
  <div>Loading... {progress.toFixed(0)}%</div>
{/if}
```

## WebGL Detection

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let hasWebGL = $state<boolean>();

  function detectWebGL(): boolean {
    if (!browser) return false;
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
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
    <img src={data.thumbnail} alt="Preview" />
  </div>
{:else if hasWebGL === true}
  <!-- 3D scene here -->
{/if}
```

## Performance Checklist

- [ ] Disable SSR: `export const ssr = false`
- [ ] Dynamic import Three.js
- [ ] Dispose geometry/materials on unmount
- [ ] Use `renderer.dispose()` + `forceContextLoss()`
- [ ] Cancel animation frame in cleanup
- [ ] Lazy load 3D pages (don't import in root layout)
- [ ] Compress models (Draco for GLTF)
- [ ] Show loading progress for large assets
- [ ] Detect device capabilities (mobile vs desktop)
- [ ] Provide static fallback images

## Common Mistakes

### ❌ Top-Level Import
```svelte
<!-- WRONG -->
<script lang="ts">
  import * as THREE from 'three'; // Breaks SSR!
</script>
```

### ✅ Dynamic Import
```svelte
<!-- RIGHT -->
<script lang="ts">
  import { onMount } from 'svelte';
  onMount(async () => {
    const THREE = await import('three');
  });
</script>
```

### ❌ Missing Cleanup
```svelte
<!-- WRONG -->
<script lang="ts">
  onMount(() => {
    const renderer = new THREE.WebGLRenderer();
    // No cleanup!
  });
</script>
```

### ✅ Proper Cleanup
```svelte
<!-- RIGHT -->
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

### ❌ Animation in $effect
```svelte
<!-- WRONG -->
<script lang="ts">
  $effect(() => {
    const animate = () => {
      requestAnimationFrame(animate); // Never stops!
    };
    animate();
  });
</script>
```

### ✅ Animation in onMount
```svelte
<!-- RIGHT -->
<script lang="ts">
  onMount(() => {
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      // ... render
    };
    animate();
    return () => cancelAnimationFrame(frameId);
  });
</script>
```

## Route Structure Template

```
src/routes/showcase/3d/
├── +layout.svelte          # Dark theme, controls overlay
├── +page.svelte            # Landing page
├── +page.ts                # export const ssr = false
├── basic-scene/
│   ├── +page.svelte        # Vanilla Three.js
│   └── +page.ts
├── gltf-viewer/
│   ├── +page.svelte        # Model loading
│   ├── +page.server.ts     # Model metadata
│   └── +page.ts
└── interactive/
    ├── +page.svelte        # Raycasting, clicks
    └── +page.ts
```

## Next Steps

1. Read full guide: `/docs/blueprint/3d-integration.md`
2. Create basic scene
3. Add OrbitControls
4. Load GLTF model
5. Add reactive controls
6. Optimize performance
7. Test WebGL fallback

## References

- **Full Guide**: `/docs/blueprint/3d-integration.md`
- **Threlte Docs**: https://threlte.xyz/docs
- **Three.js Docs**: https://threejs.org/docs
