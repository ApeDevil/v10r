# 3D Web

## What is it?

WebGL-based 3D rendering for interactive visualizations and immersive experiences. Uses Three.js as the rendering engine with optional Svelte wrappers.

## What is it for?

- Product configurators and 3D viewers
- Data visualization (3D charts, graphs)
- Interactive scenes and experiences
- Blender-exported asset rendering

## Why was it chosen?

| Option | Bundle Size | Svelte Integration | Recommendation |
|--------|-------------|-------------------|----------------|
| **Three.js** | ~150KB gzipped | Manual | Production choice |
| Threlte | +50KB wrapper | Native components | Experimental |
| Babylon.js | ~300KB | None | Too heavy |

**Three.js advantages:**
- Industry standard, massive ecosystem
- Works with Bun runtime (no native dependencies)
- Mature tree-shaking with granular imports
- glTF/GLB support (ISO standard format)

**Threlte consideration:**
- Svelte-native `<T.Mesh>` component syntax
- Broken with Svelte 5 runes mode (`@threlte/extras` incompatible as of Jan 2025)
- Recommend vanilla Three.js until Threlte stabilizes

**Bun runtime compatibility:**
- Three.js: fully compatible
- Asset processing: Bun-native file ops 2-4x faster than Node.js
- Bundler: use Vite (Bun bundler has tree-shaking issues with Three.js)

## Known limitations

**SSR incompatibility:**
- WebGL requires browser APIs (`window`, `canvas`, `document`)
- Must disable SSR on 3D pages (`export const ssr = false`)
- Dynamic imports required (no top-level `import * as THREE`)

**Bundle size:**
- Three.js is difficult to tree-shake correctly
- Full library ~600KB, typical app ~150-250KB gzipped
- Requires granular imports, not namespace imports

**Memory management:**
- WebGL contexts don't auto-cleanup on component unmount
- Must manually dispose geometries, materials, textures
- Context loss handling required for reliability

**Development experience:**
- HMR limited for WebGL initialization changes (requires full reload)
- Large textures in mounted volumes slow container HMR
- Increase container memory to 2GB for 3D development

**Threlte status:**
- `@threlte/extras` incompatible with Svelte 5 runes mode
- GitHub issue #1411 (January 2025)
- Use vanilla Three.js for production

## Related

- [Blueprint: 3D Integration](../../blueprint/3d/3d-integration.md) - Implementation patterns
- [Blueprint: 3D Quick Reference](../../blueprint/3d/3d-quick-reference.md) - Copy-paste templates
- [../core/bun.md](../core/bun.md) - Runtime compatibility
- [../core/sveltekit.md](../core/sveltekit.md) - SSR/CSR configuration
