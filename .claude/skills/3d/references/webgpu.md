# WebGPU

WebGPU is the next-generation graphics API. Production-ready in Three.js r171+, but Threlte integration has known issues.

## Current Status (Jan 2026)

| Platform | Status |
|----------|--------|
| Three.js | Production-ready (r171+) |
| Threlte | Known issues, use with caution |
| Browsers | All major browsers supported |

**Threlte Issues:**
- HMR causes crashes (Issue #1667)
- Auto-resize creates flickering and texture errors (Issue #1667)
- **Recommendation:** Stick with WebGL until resolved

## WebGPU Advantages

- **2-10x performance** for draw-call-heavy scenes
- **Compute shaders** for GPU particles, physics
- **Better multithreading** via command buffers
- **Automatic fallback** to WebGL 2

## Basic Three.js WebGPU

```typescript
import { WebGPURenderer } from 'three/webgpu';
import { Scene, PerspectiveCamera, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';

// Create renderer
const renderer = new WebGPURenderer({
  antialias: true
});

// REQUIRED: Async initialization
await renderer.init();

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Scene setup (same as WebGL)
const scene = new Scene();
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight);
camera.position.z = 5;

const mesh = new Mesh(
  new BoxGeometry(),
  new MeshStandardMaterial({ color: 'orange' })
);
scene.add(mesh);

// Render loop
function animate() {
  mesh.rotation.y += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```

## Threlte WebGPU (Experimental)

```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { WebGPURenderer } from 'three/webgpu';
</script>

<!-- Warning: Known issues with HMR and resize -->
<Canvas
  createRenderer={(canvas) => {
    const renderer = new WebGPURenderer({ canvas, antialias: true });
    // Note: init() is async, may cause issues
    return renderer;
  }}
>
  <Scene />
</Canvas>
```

**Current workarounds:**
1. Disable HMR for WebGPU components
2. Handle canvas resize manually
3. Test thoroughly before production

## TSL (Three.js Shading Language)

TSL is a node-based shader system that works on both WebGL and WebGPU.

**Why TSL:**
- Write once, runs everywhere
- Automatic optimizations
- TypeScript type safety
- Better composition than GLSL

**Basic TSL:**
```typescript
import { color, positionLocal, sin, timerLocal } from 'three/tsl';

// Animated color based on position
const colorNode = color('orange').mul(
  sin(positionLocal.y.mul(10).add(timerLocal())).mul(0.5).add(0.5)
);

const material = new MeshStandardNodeMaterial();
material.colorNode = colorNode;
```

**TSL vs GLSL:**
| Aspect | TSL | GLSL |
|--------|-----|------|
| Platform | WebGL + WebGPU | Per-platform |
| Type safety | Yes | No |
| Composability | High | Low |
| Control | Medium | Total |
| Learning curve | Gentler | Steeper |

## Compute Shaders

WebGPU enables compute shaders for non-graphics GPU work.

**Use cases:**
- GPU particle systems (millions of particles)
- Physics simulation
- Data processing
- Image effects

```typescript
import { WebGPURenderer, StorageBufferAttribute } from 'three/webgpu';
import { compute, instanceIndex, storage, float } from 'three/tsl';

// Storage buffer for compute results
const count = 1000000;
const positions = new StorageBufferAttribute(
  new Float32Array(count * 3),
  3
);

// Compute shader that updates positions
const computeShader = compute(() => {
  const position = storage(positions, 'vec3', count).element(instanceIndex);
  position.y = float(instanceIndex).div(count).mul(10);
});

// Run compute
await renderer.computeAsync(computeShader);
```

## Migration Path

**1. Test WebGL performance first**
Most scenes don't need WebGPU. Profile before migrating.

**2. Isolate WebGPU code**
```
src/lib/3d/
  renderers/
    webgl.ts
    webgpu.ts
  Scene.svelte  <!-- Renderer-agnostic -->
```

**3. Feature detection**
```typescript
const supportsWebGPU = 'gpu' in navigator;

const renderer = supportsWebGPU
  ? new WebGPURenderer()
  : new WebGLRenderer();

if (supportsWebGPU) {
  await renderer.init();
}
```

**4. Gradual adoption**
- Keep WebGL as default
- Enable WebGPU behind feature flag
- Test across devices

## When to Use WebGPU

**Use WebGPU if:**
- 100+ draw calls per frame
- Complex particle systems
- GPU compute requirements
- Performance bottleneck on WebGL

**Stick with WebGL if:**
- Performance is acceptable
- Using Threlte (until issues resolved)
- Targeting legacy browsers
- Simple scenes

## Bundle Size

**WebGPU increases bundle size.** Use explicit imports:

```typescript
// GOOD: Explicit imports (tree-shakeable)
import { WebGPURenderer } from 'three/webgpu';
import { MeshStandardNodeMaterial } from 'three/webgpu';

// AVOID: Convenience imports (larger bundle)
import * as THREE from 'three/webgpu';
```

## Debugging

**WebGPU debugging tools:**
- Chrome DevTools → Application → WebGPU
- [WebGPU Inspector](https://github.com/nicololobdev/WebGPU-inspector) browser extension

**Logging:**
```typescript
const renderer = new WebGPURenderer({
  antialias: true,
  // Enable debug info
  powerPreference: 'high-performance'
});

await renderer.init();
console.log('GPU:', renderer.backend.adapter?.info);
```

## Known Limitations

1. **Threlte HMR crashes** - Restart dev server after WebGPU changes
2. **Auto-resize flickers** - Handle resize manually
3. **Some Three.js features unsupported** - Check compatibility
4. **Safari quirks** - Test thoroughly on iOS/macOS
5. **Memory management** - Same disposal rules as WebGL

## Resources

- [Three.js WebGPU Examples](https://threejs.org/examples/?q=webgpu)
- [TSL Documentation](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [Three.js WebGPU Migration](https://threejs.org/docs/pages/WebGPURenderer.html)
