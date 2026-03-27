# Performance Optimization

Patterns for high-performance 3D scenes in Threlte.

## Draw Call Budget

**Target: Under 100 draw calls per frame.**

Each unique material + geometry combination = 1 draw call.

**Monitor draw calls:**
```svelte
<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';

  const { renderer } = useThrelte();

  useTask(() => {
    console.log({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      points: renderer.info.render.points,
      lines: renderer.info.render.lines
    });
  });
</script>
```

## Instancing

**InstancedMesh: 90%+ draw call reduction for repeated objects.**

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { Instance, InstancedMesh } from '@threlte/extras';
  import { Matrix4, Vector3, Quaternion, Euler } from 'three';

  const count = 1000;
  const transforms: { position: Vector3; rotation: Euler; scale: Vector3 }[] = [];

  for (let i = 0; i < count; i++) {
    transforms.push({
      position: new Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      rotation: new Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ),
      scale: new Vector3(1, 1, 1)
    });
  }
</script>

<InstancedMesh>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color="orange" />

  {#each transforms as t}
    <Instance position={t.position} rotation={t.rotation} scale={t.scale} />
  {/each}
</InstancedMesh>
```

**Dynamic updates:**
```svelte
<script lang="ts">
  import { useTask } from '@threlte/core';
  import { InstancedMesh } from '@threlte/extras';

  let instances: Instance[] = [];
  let time = 0;

  useTask((delta) => {
    time += delta;
    instances.forEach((instance, i) => {
      instance.position.y = Math.sin(time + i * 0.1);
    });
  });
</script>

<InstancedMesh>
  <T.SphereGeometry args={[0.1]} />
  <T.MeshBasicMaterial color="blue" />

  {#each Array(100) as _, i}
    <Instance bind:this={instances[i]} position.x={i * 0.5} />
  {/each}
</InstancedMesh>
```

## BatchedMesh (Three.js r156+)

**Combine different geometries with same material into single draw call.**

```typescript
import { BatchedMesh, BoxGeometry, SphereGeometry, ConeGeometry } from 'three';

const batchedMesh = new BatchedMesh(100, 50000, 100000);

// Add different geometries
const boxId = batchedMesh.addGeometry(new BoxGeometry());
const sphereId = batchedMesh.addGeometry(new SphereGeometry());
const coneId = batchedMesh.addGeometry(new ConeGeometry());

// Add instances of each geometry
for (let i = 0; i < 30; i++) {
  const instanceId = batchedMesh.addInstance(boxId);
  batchedMesh.setMatrixAt(instanceId, matrix);
}
```

**InstancedMesh vs BatchedMesh:**
| Feature | InstancedMesh | BatchedMesh |
|---------|---------------|-------------|
| Same geometry | Required | Different OK |
| Draw calls | 1 | 1 |
| Flexibility | Lower | Higher |
| Setup complexity | Lower | Higher |

## Material Optimization

**Share materials:**
```svelte
<script lang="ts">
  import { MeshStandardMaterial } from 'three';

  // One material, multiple meshes
  const material = new MeshStandardMaterial({
    color: 0x4488ff,
    roughness: 0.5,
    metalness: 0.2
  });
</script>

<T.Mesh><T.BoxGeometry /><T is={material} /></T.Mesh>
<T.Mesh position.x={2}><T.SphereGeometry /><T is={material} /></T.Mesh>
<T.Mesh position.x={4}><T.ConeGeometry /><T is={material} /></T.Mesh>
```

**Material complexity hierarchy:**
| Material | Cost | Use Case |
|----------|------|----------|
| MeshBasicMaterial | Lowest | Unlit, wireframes |
| MeshLambertMaterial | Low | Diffuse only |
| MeshPhongMaterial | Medium | Shiny surfaces |
| MeshStandardMaterial | High | PBR (default) |
| MeshPhysicalMaterial | Highest | Glass, clearcoat |

## Level of Detail (LOD)

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { LOD } from 'three';
  import { useGltf } from '@threlte/extras';

  const highPoly = useGltf('/model-high.glb');
  const mediumPoly = useGltf('/model-medium.glb');
  const lowPoly = useGltf('/model-low.glb');
</script>

<T.LOD>
  {#if $highPoly}
    <T is={$highPoly.scene} userData={{ lodLevel: 0, distance: 0 }} />
  {/if}
  {#if $mediumPoly}
    <T is={$mediumPoly.scene} userData={{ lodLevel: 1, distance: 50 }} />
  {/if}
  {#if $lowPoly}
    <T is={$lowPoly.scene} userData={{ lodLevel: 2, distance: 100 }} />
  {/if}
</T.LOD>
```

**LOD distance guidelines:**
| Distance | Poly Count | Purpose |
|----------|------------|---------|
| 0-20 | Full | Close inspection |
| 20-100 | 50% | Mid-range |
| 100+ | 10-25% | Background |

## Frustum Culling

Automatic in Three.js. Objects outside camera view aren't rendered.

**Verify culling is working:**
```typescript
// If draw calls don't decrease when looking away, check:
mesh.frustumCulled = true; // Should be default
```

**Large objects may need manual bounds:**
```typescript
mesh.geometry.computeBoundingSphere();
mesh.geometry.computeBoundingBox();
```

## Lighting Optimization

**Limit active lights:**
```svelte
<!-- BAD: Too many lights -->
{#each Array(10) as _}
  <T.PointLight />
{/each}

<!-- GOOD: 2-3 lights max -->
<T.AmbientLight intensity={0.4} />
<T.DirectionalLight intensity={1} />
<T.PointLight intensity={0.5} /> <!-- If needed -->
```

**Shadow optimization:**
```svelte
<script lang="ts">
  import { useThrelte } from '@threlte/core';

  const { scene } = useThrelte();

  // Disable shadow auto-update for static scenes
  $effect(() => {
    scene.traverse((child) => {
      if (child.isLight && child.shadow) {
        child.shadow.autoUpdate = false;
        child.shadow.needsUpdate = true; // Update once
      }
    });
  });
</script>
```

**Shadow map sizes:**
| Size | Quality | Performance |
|------|---------|-------------|
| 512 | Low | Fast |
| 1024 | Medium | Balanced |
| 2048 | High | Slow |
| 4096 | Ultra | Very slow |

## Geometry Merging

**Merge static geometries:**
```typescript
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';

const geometries = meshes.map(m => m.geometry.clone());
geometries.forEach((g, i) => {
  g.applyMatrix4(meshes[i].matrixWorld);
});

const merged = BufferGeometryUtils.mergeGeometries(geometries);
const mergedMesh = new Mesh(merged, sharedMaterial);
```

**When to merge:**
- Static environments (buildings, terrain)
- Decorative objects that don't move
- Don't merge: animated, interactive, or frequently toggled objects

## Render Loop Optimization

**Conditional rendering:**
```svelte
<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';

  const { invalidate } = useThrelte();
  let needsUpdate = $state(false);

  // Only render when needed
  useTask(() => {
    if (needsUpdate) {
      invalidate();
      needsUpdate = false;
    }
  });
</script>
```

**Frame limiting:**
```svelte
<Canvas frameloop="demand">
  <!-- Only renders when invalidated -->
</Canvas>
```

## Performance Checklist

1. **Draw calls under 100?**
2. **Materials shared where possible?**
3. **Instancing for repeated objects?**
4. **LOD for distant objects?**
5. **Shadow maps appropriately sized?**
6. **Lights limited to 2-3?**
7. **Static geometry merged?**
8. **Pixel ratio capped at 2?**
9. **Unused objects disposed?**
10. **Interactivity only where needed?**
