# Blender to Web Pipeline

Integration guide for using Blender-exported 3D assets in the Velociraptor SvelteKit + Threlte stack.

## Quick Start

### Prerequisites
- Blender 4.2 LTS (recommended)
- Existing Threlte setup (see `/docs/blueprint/3d/3d-integration.md`)

### Minimal Test (10 minutes)

**1. Create test asset in Blender:**
```
1. Open Blender 4.2 LTS
2. Default cube is fine (uses Principled BSDF)
3. Optionally add 512x512 PNG texture to Base Color
4. File > Export > glTF 2.0 (.glb)
   - Uncheck "+Y up"
   - Apply Modifiers: ON
   - Format: glTF Binary (.glb)
```

**2. Validate export:**
- Drag GLB to [threejs.org/editor](https://threejs.org/editor)
- If it renders → export is valid
- If not → fix in Blender before touching code

**3. Transform for Threlte:**
```bash
# From container
npx @threlte/gltf@latest test-cube.glb --transform
```
Generates:
- `TestCube.svelte` - Reusable component
- `test-cube-transformed.glb` - Optimized (Draco + texture compression)

**4. Use in SvelteKit:**
```bash
# Move files
mv test-cube-transformed.glb static/models/
mv TestCube.svelte src/lib/components/3d/
```

```svelte
<!-- src/routes/showcase/3d/blender-test/+page.svelte -->
<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import TestCube from '$lib/components/3d/TestCube.svelte';
</script>

<div class="container">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[5, 5, 5]} />
    <T.DirectionalLight position={[10, 10, 10]} intensity={1} />
    <T.AmbientLight intensity={0.5} />

    <TestCube />

    <OrbitControls />
  </Canvas>
</div>

<style>
  .container { width: 100%; height: 100vh; }
</style>
```

```typescript
// src/routes/showcase/3d/blender-test/+page.ts
export const ssr = false;
export const prerender = false;
```

## What Works

### Materials
- **Principled BSDF** - Maps directly to glTF PBR standard
- Supported texture maps:
  - Base Color
  - Metallic
  - Roughness
  - Normal
  - Ambient Occlusion
  - Emissive

### Textures
- PNG and JPEG only (glTF spec)
- Other formats auto-convert (slower export)
- Max 2 UV maps supported

### Animations
- Object transforms (position, rotation, scale)
- Armature/bone animations
- Shape keys / morph targets

### Geometry
- Meshes up to ~500k polygons (total scene)
- Single armature per file recommended

## What Doesn't Work

### Never Exports
| Feature | Workaround |
|---------|------------|
| Blender lights | Create in Threlte |
| Blender cameras | Create in Threlte |
| World/HDRI environment | Use Three.js environment maps |
| Procedural textures | Bake to image textures |
| Complex shader nodes | Stick to Principled BSDF |
| Particles | Bake to mesh or recreate in code |

### Requires Special Handling
| Feature | Solution |
|---------|----------|
| Shape keys + modifiers | Apply modifiers BEFORE creating shape keys |
| Multiple materials on one mesh | Exports as multiple meshes (by design) |
| Animation blending | Strip redundant static data |
| Unweighted vertices | Weight paint all geometry |

## Export Settings

### Recommended Settings
```
Format: glTF Binary (.glb)
Include: Selected Objects (or all)

Transform:
  +Y Up: UNCHECKED (prevents rotation issues)

Geometry:
  Apply Modifiers: ON
  UVs: ON
  Normals: ON
  Tangents: ON (if using normal maps)
  Vertex Colors: ON (if used)

Material:
  Materials: Export
  Images: Automatic

Animation:
  Animation: ON (if needed)
  Sampling Rate: 1

Compression:
  Compress: OFF (let @threlte/gltf handle it)
```

### Why No Compression in Blender?
`@threlte/gltf --transform` applies:
- Draco compression (better than Blender's)
- Texture resize to 1024x1024
- WebP conversion
- Mesh deduplication

Single command beats multi-tool pipeline.

## Troubleshooting

### Model Invisible
1. **Check scale** - Try `scale={0.01}` or `scale={100}`
2. **Check camera position** - Move to `[50, 50, 50]`
3. **Add GridHelper** - `<T.GridHelper size={100} />` to see coordinate system

### Model Appears Black
- **Missing lights** - Blender lights don't export
- Add: `<T.AmbientLight intensity={0.5} />` + `<T.DirectionalLight />`

### Materials Look Wrong
- **Not using Principled BSDF** - Only supported shader
- **Procedural textures** - Must bake to images
- **Wrong color space** - Normal maps need "Non-Color"

### Textures Missing
- **External references** - Ensure textures are embedded
- **Wrong format** - Use PNG or JPEG only

### Animation Doesn't Play
- **Not in NLA Editor** - Push action to NLA track
- **Track not visible** - Ensure NLA strip is visible during export

### 404 Error Loading Model
- **Wrong path** - Models go in `static/models/`
- **URL should be** - `/models/your-model.glb` (no `static` prefix)

### Coordinates Seem Wrong
- **Y/Z axis swapped** - Uncheck "+Y up" in Blender export
- Models rotated 90° is classic symptom

## File Organization

```
static/
  models/
    robot.glb              # Original (or transformed)
    car.glb

src/lib/components/3d/
  Robot.svelte             # Generated by @threlte/gltf
  Car.svelte

src/routes/showcase/3d/
  blender-test/
    +page.svelte           # Test route
    +page.ts               # ssr = false
```

## Optimization Pipeline

### For Simple Models (<1MB)
1. Export GLB from Blender (no compression)
2. Run `npx @threlte/gltf model.glb --transform`
3. Use generated component

### For Complex Models (>1MB)
1. In Blender: reduce poly count with Decimation modifier
2. Export GLB
3. Run `npx @threlte/gltf model.glb --transform`
4. If still large: use gltf-pipeline for aggressive compression

### Compression Results (Real-World)
| Tool | Reduction |
|------|-----------|
| Blender Draco | ~80% |
| @threlte/gltf --transform | ~85% |
| gltf-pipeline | ~97% |

## Alternative: Raw GLTF Loading

If you don't want generated components:

```svelte
<script lang="ts">
  import { GLTF } from '@threlte/extras';
</script>

<GLTF url="/models/robot.glb" scale={1} />
```

Or with loading state:

```svelte
<script lang="ts">
  import { useGltf } from '@threlte/extras';
  import { T } from '@threlte/core';

  const gltf = useGltf('/models/robot.glb');
</script>

{#await gltf}
  <!-- Loading -->
{:then data}
  <T.Primitive object={data.scene} />
{:catch error}
  <!-- Error: {error.message} -->
{/await}
```

## Testing Checklist

- [ ] Blender scene uses only Principled BSDF materials
- [ ] Textures are PNG or JPEG (embedded, not external)
- [ ] Export validates in threejs.org/editor
- [ ] `@threlte/gltf --transform` runs without errors
- [ ] Model visible in Threlte (check scale, lights, camera)
- [ ] Materials render correctly
- [ ] Animations play (if applicable)
- [ ] File size acceptable for web (<5MB recommended)

## References

- [Blender glTF 2.0 Manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [@threlte/gltf Documentation](https://threlte.xyz/docs/reference/gltf/getting-started)
- [Three.js Loading 3D Models](https://threejs.org/manual/en/loading-3d-models.html)
- [glTF Viewer (Validation Tool)](https://gltf-viewer.donmccurdy.com/)
- [Velociraptor 3D Integration Guide](/docs/blueprint/3d/3d-integration.md)
