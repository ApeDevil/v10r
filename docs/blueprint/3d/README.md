# 3D Web Integration

Implementation blueprints for adding 3D experiences to the SvelteKit application using Threlte 8 (Svelte's Three.js renderer) and Blender-exported glTF assets.

| File | Topics |
|------|--------|
| [3d-integration.md](3d-integration.md) | Threlte 8 scene pattern, route structure (`/showcases/3d/`), SSR-off layout (and the `@` leaves that escape it), Svelte 5 runes with WebGL, model registry + code-splitting, GLTF loading, part explorer (opt-in click-to-inspect: registry, theme-accent outline + ghosting, camera fly-to, photo panel + lightbox), `<svelte:boundary>` fallback, anti-patterns, implementation checklist |
| [3d-quick-reference.md](3d-quick-reference.md) | Copy-paste Threlte templates, page setup, `<Canvas>` + `<T>` scenes, `useTask` animation, reactive controls, `useGltf` model loading, `<svelte:boundary>` fallback, route structure template |
| [product-composition.md](product-composition.md) | Products with typed ports joined into an editable assembly (`$lib/product-composition/`): layer split, port frames + IFC 4.3 mapping, invariants and the tests holding them, pure operations + diagnostics, Threlte editing layer (gizmo + CameraControls pause, keyboard path), plausibility-not-certification line, honest scope, routing evaluation (not built), seams outside the core, emulation steps |
