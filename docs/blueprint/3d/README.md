# 3D Web Integration

Implementation blueprints for adding 3D experiences to the SvelteKit application using Threlte 8 (Svelte's Three.js renderer) and Blender-exported glTF assets.

| File | Topics |
|------|--------|
| [3d-integration.md](3d-integration.md) | Threlte 8 scene pattern, route structure (`/showcases/3d/`), SSR/prerender-off strategy, Svelte 5 runes with WebGL, model registry + code-splitting, GLTF loading, part explorer (opt-in click-to-inspect: registry, emissive highlight, camera fly-to), `<svelte:boundary>` fallback, anti-patterns, implementation checklist |
| [3d-quick-reference.md](3d-quick-reference.md) | Copy-paste Threlte templates, page setup, `<Canvas>` + `<T>` scenes, `useTask` animation, reactive controls, `useGltf` model loading, `<svelte:boundary>` fallback, route structure template |
