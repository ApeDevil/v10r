# Asset Loading

Patterns for loading and optimizing 3D assets in Threlte.

## GLTF Loading

**Basic loading:**
```svelte
<script lang="ts">
  import { useGltf } from '@threlte/extras';

  const gltf = useGltf('/models/scene.glb');
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{/if}
```

**With type safety:**
```typescript
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

interface MyModelGLTF extends GLTF {
  nodes: {
    Head: Mesh;
    Body: Mesh;
    Arm_L: Mesh;
  };
  materials: {
    Skin: MeshStandardMaterial;
    Cloth: MeshStandardMaterial;
  };
}

const gltf = useGltf<MyModelGLTF>('/model.glb');
```

## Draco Compression

**90-95% geometry size reduction.** Decompresses in Web Worker.

```svelte
<script lang="ts">
  import { useGltf, useDraco } from '@threlte/extras';

  // Initialize decoder (call once per scene)
  useDraco();

  // Or specify custom decoder path
  useDraco('/draco/');

  const gltf = useGltf('/compressed-model.glb');
</script>
```

**Compressing models (gltf-pipeline):**
```bash
gltf-pipeline -i model.glb -o model-draco.glb --draco.compressionLevel 10
```

## KTX2/Basis Universal Textures

**~10x VRAM reduction.** Textures stay compressed on GPU.

```svelte
<script lang="ts">
  import { useGltf, useKtx2 } from '@threlte/extras';

  // Initialize transcoder
  useKtx2();

  const gltf = useGltf('/model-with-ktx2.glb');
</script>
```

**Texture quality tiers:**
| Format | Quality | File Size | Use Case |
|--------|---------|-----------|----------|
| UASTC | High | Larger | Normal maps, hero textures |
| ETC1S | Medium | Smaller | Environment, secondary |

**Converting textures (toktx from KTX-Software):**
```bash
# UASTC (high quality)
toktx --t2 --encode uastc --uastc_quality 4 output.ktx2 input.png

# ETC1S (smaller)
toktx --t2 --encode etc1s --clevel 4 output.ktx2 input.png
```

## Meshopt Compression

Alternative to Draco with different tradeoffs.

```svelte
<script lang="ts">
  import { useGltf, useMeshopt } from '@threlte/extras';

  useMeshopt();

  const gltf = useGltf('/meshopt-model.glb');
</script>
```

**Draco vs Meshopt:**
| Feature | Draco | Meshopt |
|---------|-------|---------|
| Compression | Higher | Good |
| Decode speed | Slower | Faster |
| Browser support | Wider | Modern |
| Animation | No | Yes |

## Texture Loading

```svelte
<script lang="ts">
  import { useTexture } from '@threlte/extras';

  const texture = useTexture('/textures/diffuse.jpg');
  const [diffuse, normal, roughness] = useTexture([
    '/textures/diffuse.jpg',
    '/textures/normal.jpg',
    '/textures/roughness.jpg'
  ]);
</script>

{#if $texture}
  <T.MeshStandardMaterial map={$texture} />
{/if}
```

**Texture settings:**
```svelte
<script lang="ts">
  import { useTexture } from '@threlte/extras';
  import { RepeatWrapping, LinearFilter } from 'three';

  const texture = useTexture('/texture.jpg', {
    transform: (texture) => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(4, 4);
      texture.minFilter = LinearFilter;
      return texture;
    }
  });
</script>
```

## HDR Environment Maps

```svelte
<script lang="ts">
  import { Environment } from '@threlte/extras';
</script>

<!-- From file -->
<Environment files="/hdri/studio.hdr" />

<!-- From URL -->
<Environment
  files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr"
/>

<!-- Preset -->
<Environment preset="studio" />
```

**Available presets:** `apartment`, `city`, `dawn`, `forest`, `lobby`, `night`, `park`, `studio`, `sunset`, `warehouse`

## Preloading

**Preload before navigation:**
```svelte
<script lang="ts">
  import { preloadGltf, preloadTexture } from '@threlte/extras';
  import { onMount } from 'svelte';

  onMount(() => {
    // Start preloading
    preloadGltf('/models/hero.glb');
    preloadTexture('/textures/hero.jpg');
  });
</script>
```

**With suspense-like pattern:**
```svelte
<script lang="ts">
  import { useGltf, useSuspense } from '@threlte/extras';

  const suspend = useSuspense();
  const gltf = suspend(useGltf('/model.glb'));
</script>

<!-- Parent handles loading state -->
```

## Caching

Assets are automatically cached by Threlte. Same URL = same asset.

```svelte
<!-- Both use the same cached model -->
<Model1 url="/shared.glb" />
<Model2 url="/shared.glb" />
```

**Clear cache (for development):**
```typescript
import { useGltf } from '@threlte/extras';
useGltf.clear('/model.glb'); // Clear specific
useGltf.clear(); // Clear all
```

## Asset Organization

**Recommended structure:**
```
static/
  models/
    characters/
      hero.glb
      enemy.glb
    environment/
      terrain.glb
  textures/
    characters/
      hero-diffuse.jpg
      hero-normal.jpg
    environment/
  hdri/
    studio.hdr
```

**Loading strategies:**
| Strategy | When | Example |
|----------|------|---------|
| Eager | Critical, visible immediately | Hero model |
| Lazy | Below fold, on interaction | Modal content |
| Preload | Next page, predictable navigation | Gallery thumbnails |
| Stream | Large assets, progressive | Environment maps |

## Fallbacks

```svelte
<script lang="ts">
  import { useGltf } from '@threlte/extras';

  const gltf = useGltf('/model.glb');
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{:else}
  <!-- Loading fallback -->
  <T.Mesh>
    <T.BoxGeometry args={[1, 2, 1]} />
    <T.MeshBasicMaterial color="#333" wireframe />
  </T.Mesh>
{/if}
```
