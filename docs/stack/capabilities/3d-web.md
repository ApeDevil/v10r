# 3D Web

WebGL 3D rendering via Threlte 8 (`@threlte/core`, `@threlte/extras`) over Three.js. See the `3d` skill for scene/GLTF/physics patterns.

## Why was it chosen?

- **Threlte 8 is the single, required approach** — declarative scenes with Svelte 5 reactivity. Vanilla Three.js is not used (see [3d-integration.md](../../blueprint/3d/3d-integration.md)).
- Three.js underneath is Bun-compatible (no native deps), with glTF/GLB support and granular tree-shakeable imports. `three` is imported directly only for `AnimationMixer`, `AnimationClip`, and types.

## Known limitations

- **SSR:** WebGL needs browser APIs — disable SSR and prerender once at `showcases/3d/+layout.ts` (`ssr = false`, `prerender = false`) for the whole subtree. With SSR off, top-level static imports of `three`, `@threlte/core`, and `@threlte/extras` are safe; code-splitting comes from keeping scene imports in the route, not from dynamic-importing THREE.
- **Memory:** in general Three.js, WebGL contexts don't auto-cleanup on unmount and you dispose geometries, materials, and textures by hand. Here, Threlte owns the renderer lifecycle and GPU-resource disposal; the app only manages the `AnimationMixer` lifecycle in a `$effect`. See the `3d` skill for the underlying Three.js details.
- **Container HMR:** large mounted textures slow HMR; bump container memory to 2GB for 3D work.

## Related

- [Blueprint: 3D Integration](../../blueprint/3d/3d-integration.md) - Implementation patterns
- [Blueprint: 3D Quick Reference](../../blueprint/3d/3d-quick-reference.md) - Copy-paste templates
- [../core/bun.md](../core/bun.md) - Runtime compatibility
- [../core/sveltekit.md](../core/sveltekit.md) - SSR/CSR configuration
