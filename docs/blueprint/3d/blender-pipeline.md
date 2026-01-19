# Blender Pipeline

Export and optimization workflow for 3D models from Blender to Velociraptor.

## Export Settings

### glTF 2.0 Binary (.glb)

Blender: **File → Export → glTF 2.0**

| Setting | Value | Reason |
|---------|-------|--------|
| Format | glTF Binary (.glb) | Single file, faster loading |
| Copyright | Your name/license | Metadata preservation |
| Remember Export Settings | ✓ | Consistency |

**Include:**
| Setting | Value |
|---------|-------|
| Selected Objects | As needed |
| Visible Objects | As needed |
| Renderable Objects | ✓ |
| Active Collection | As needed |
| Include Nested Collections | ✓ |
| Active Scene | ✓ |
| Custom Properties | ✗ (security) |
| Cameras | ✗ |
| Punctual Lights | ✗ |

**Transform:**
| Setting | Value |
|---------|-------|
| +Y Up | ✓ (glTF convention) |

**Data → Mesh:**
| Setting | Value | Reason |
|---------|-------|--------|
| Apply Modifiers | ✓ | Bake all modifiers |
| UVs | ✓ | Texture mapping |
| Normals | ✓ | Lighting |
| Tangents | ✓ if normal maps | Required for normal mapping |
| Vertex Colors | As needed | |
| Attributes | As needed | |
| Loose Edges | ✗ | Cleanup |
| Loose Points | ✗ | Cleanup |

**Data → Material:**
| Setting | Value |
|---------|-------|
| Materials | Export |
| Images | Automatic |

**Data → Compression:**
| Setting | Value | Reason |
|---------|-------|--------|
| Compression | ✓ | Enable Draco |
| Compression Level | 6 | Balance: size vs decode time |
| Quantization Position | 14 | Good precision |
| Quantization Normal | 10 | Sufficient for normals |
| Quantization Tex Coord | 12 | Good UV precision |
| Quantization Color | 10 | Sufficient |
| Quantization Generic | 12 | |

**Animation:**
| Setting | Value |
|---------|-------|
| Use Current Frame | ✓ if static |
| Animations | ✓ if animated |
| Limit to Playback Range | ✓ |
| Sampling Rate | 1 |
| Always Sample Animations | As needed |
| Group by NLA Track | ✓ |
| Optimize Animation Size | ✓ |
| Export All Armature Actions | As needed |
| Export Shape Keys | ✓ if used |
| Shape Keys Normals | ✓ if used |
| Export Shape Keys Tangent | ✗ usually |

---

## Pre-Export Checklist

### Geometry Optimization

1. **Apply all transforms**: `Ctrl+A` → All Transforms
2. **Apply modifiers** you want baked (or enable in export)
3. **Remove doubles**: Edit Mode → `M` → Merge by Distance
4. **Check normals**: Edit Mode → Mesh → Normals → Recalculate Outside
5. **Decimate if needed**: Modifier → Decimate (target: 50-100K triangles)

### UV Optimization

1. **Single UV map** per mesh when possible
2. **Efficient island packing**: UV → Pack Islands
3. **No overlapping UVs** unless intentional
4. **Consistent texel density**: UV → Average Islands Scale

### Material Setup

1. **Use Principled BSDF** (maps to glTF PBR)
2. **Supported maps**:
   - Base Color (albedo)
   - Metallic
   - Roughness
   - Normal
   - Emissive
   - Occlusion
   - Alpha (for transparency)
3. **Image textures**: Power-of-2 sizes (512, 1024, 2048, 4096)
4. **Bake complex shaders** to textures if needed

### Naming Conventions

```
scene-name_object-name_variant.glb

Examples:
character_robot_idle.glb
environment_office_low.glb
prop_chair_damaged.glb
```

---

## Polygon Limits

| Target Device | Max Triangles | Max Vertices |
|---------------|---------------|--------------|
| Mobile (entry) | 30,000 | 50,000 |
| Mobile (flagship) | 100,000 | 150,000 |
| Desktop (integrated GPU) | 150,000 | 250,000 |
| Desktop (dedicated GPU) | 500,000 | 750,000 |

**Velociraptor defaults**: 250K triangles, 500K vertices max.

### Checking Counts in Blender

**Statistics overlay**: Viewport Overlays → Statistics

Or via Python:
```python
import bpy
obj = bpy.context.active_object
if obj.type == 'MESH':
    print(f"Vertices: {len(obj.data.vertices)}")
    print(f"Edges: {len(obj.data.edges)}")
    print(f"Faces: {len(obj.data.polygons)}")
    # Triangles = faces if all quads would be split
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"Triangles: {tris}")
```

---

## Texture Guidelines

### Size Recommendations

| Texture Type | Recommended | Maximum |
|--------------|-------------|---------|
| Diffuse/Albedo | 1024×1024 | 2048×2048 |
| Normal | 1024×1024 | 2048×2048 |
| Roughness/Metallic | 512×512 | 1024×1024 |
| Ambient Occlusion | 512×512 | 1024×1024 |
| Emissive | 512×512 | 1024×1024 |

### Texture Packing

Pack channels to reduce texture count:

| Packed Texture | R | G | B | A |
|----------------|---|---|---|---|
| ORM Map | Occlusion | Roughness | Metallic | - |
| Normal+AO | Normal.R | Normal.G | - | Occlusion |

### Format Optimization

For production, convert textures to Basis Universal (KTX2):

```bash
# Using gltf-transform CLI
gltf-transform etc1s input.glb output.glb --slots "baseColor"
gltf-transform uastc input.glb output.glb --slots "normal"
```

---

## LOD Generation

### Manual LOD in Blender

1. Duplicate object: `Shift+D`
2. Add Decimate modifier
3. Reduce to target triangle count
4. Name with LOD suffix: `model_lod0`, `model_lod1`, `model_lod2`

| LOD Level | Distance | Reduction |
|-----------|----------|-----------|
| LOD0 | 0-5m | 100% (original) |
| LOD1 | 5-15m | 50% |
| LOD2 | 15-30m | 25% |
| LOD3 | 30m+ | 10% |

### Automated LOD (gltf-transform)

```bash
# Install
npm install -g @gltf-transform/cli

# Generate LOD variants
gltf-transform simplify input.glb lod1.glb --ratio 0.5
gltf-transform simplify input.glb lod2.glb --ratio 0.25
gltf-transform simplify input.glb lod3.glb --ratio 0.1
```

---

## Compression Pipeline

### Full Optimization Command

```bash
#!/bin/bash
# optimize-model.sh

INPUT=$1
OUTPUT=${2:-${INPUT%.glb}-optimized.glb}

gltf-transform optimize "$INPUT" "$OUTPUT" \
  --compress draco \
  --texture-compress webp \
  --texture-size 2048 \
  --simplify-ratio 0.75 \
  --simplify-error 0.001
```

### Draco Compression Only

```bash
gltf-transform draco input.glb output.glb \
  --method edgebreaker \
  --encode-speed 5 \
  --decode-speed 5
```

### Texture Compression Only

```bash
# WebP (lossy, smaller, good quality)
gltf-transform webp input.glb output.glb --quality 80

# Basis Universal (GPU-compressed, best for large textures)
gltf-transform ktx2 input.glb output.glb
```

---

## Batch Processing

### Blender Python Script

```python
# batch_export.py
# Run: blender --background --python batch_export.py -- input_dir output_dir

import bpy
import os
import sys

argv = sys.argv
argv = argv[argv.index("--") + 1:]
input_dir = argv[0]
output_dir = argv[1]

os.makedirs(output_dir, exist_ok=True)

for filename in os.listdir(input_dir):
    if filename.endswith('.blend'):
        filepath = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename.replace('.blend', '.glb'))

        # Clear scene
        bpy.ops.wm.read_factory_settings(use_empty=True)

        # Open file
        bpy.ops.wm.open_mainfile(filepath=filepath)

        # Export
        bpy.ops.export_scene.gltf(
            filepath=output_path,
            export_format='GLB',
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_apply=True,
        )

        print(f"Exported: {output_path}")
```

### Shell Batch Script

```bash
#!/bin/bash
# batch_optimize.sh

INPUT_DIR=$1
OUTPUT_DIR=$2

mkdir -p "$OUTPUT_DIR"

for file in "$INPUT_DIR"/*.glb; do
  filename=$(basename "$file")
  output="$OUTPUT_DIR/$filename"

  echo "Processing: $filename"

  gltf-transform optimize "$file" "$output" \
    --compress draco \
    --texture-compress webp \
    --texture-size 2048

  # Report size reduction
  original=$(stat -f%z "$file" 2>/dev/null || stat --printf="%s" "$file")
  optimized=$(stat -f%z "$output" 2>/dev/null || stat --printf="%s" "$output")
  reduction=$((100 - (optimized * 100 / original)))

  echo "  $original → $optimized bytes ($reduction% reduction)"
done
```

---

## Validation

### gltf-transform Validation

```bash
# Validate file
gltf-transform validate model.glb

# Get detailed report
gltf-transform inspect model.glb
```

### Online Validators

- [glTF Validator](https://github.khronos.org/glTF-Validator/)
- [Sketchfab Viewer](https://sketchfab.com) (upload test)
- [model-viewer Editor](https://modelviewer.dev/editor/)

### Three.js Test Loading

```javascript
// Quick browser console test
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/path/to/model.glb',
  (gltf) => console.log('Success:', gltf),
  (progress) => console.log('Progress:', progress.loaded / progress.total),
  (error) => console.error('Error:', error)
);
```

---

## Common Issues

### Problem: Model appears too small/large
**Solution**: In Blender, scale to real-world units. 1 Blender unit = 1 meter in glTF.

### Problem: Textures appear black
**Solution**: Check UV mapping exists. Unwrap if missing.

### Problem: Model has wrong orientation
**Solution**: Apply transforms (`Ctrl+A` → All Transforms) before export.

### Problem: Transparent materials not working
**Solution**: In Principled BSDF, set Alpha and connect to Alpha input. Set blend mode to Alpha Blend in Material Properties.

### Problem: Normal maps look inverted
**Solution**: glTF uses OpenGL normal map convention (+Y up). In Blender's Normal Map node, set space to Tangent Space.

### Problem: File too large after export
**Solutions**:
1. Enable Draco compression
2. Reduce texture sizes (max 2048)
3. Decimate geometry
4. Remove unused materials/textures
5. Bake multiple textures into atlas

### Problem: Animation stutters in viewer
**Solutions**:
1. Reduce keyframes (enable "Optimize Animation Size")
2. Lower sampling rate
3. Simplify armature (fewer bones)
