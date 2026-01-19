# 3D Integration

3D model visualization with Blender pipeline support. Enables uploading, storing, and rendering 3D models in the browser using Three.js and Threlte.

## Overview

| File | Main Topics |
|------|-------------|
| **[architecture.md](./architecture.md)** | • Technology stack: Three.js + Threlte v9<br>• File structure: engine layer vs Svelte wrappers + typed context helpers<br>• Data model: PostgreSQL (ownership) + Neo4j (similarity only) + R2<br>• LRU cache, auth integration, prefixed IDs |
| **[implementation.md](./implementation.md)** | • Phase 1: Foundation (components, loader)<br>• Phase 2: Pipeline (upload, storage, processing)<br>• Phase 3: Polish (UX, accessibility, performance)<br>• Phase 4: Enhancement (WebGPU, AR/VR) |
| **[blender-pipeline.md](./blender-pipeline.md)** | • Export settings: glTF 2.0 Binary (.glb)<br>• Compression: Draco geometry + Basis Universal textures<br>• Optimization: LOD generation, polygon limits<br>• Batch processing: CLI automation |
| **[security.md](./security.md)** | • File validation: magic bytes + chunk validation, pre-parse limits<br>• XSS prevention: recursive metadata sanitization<br>• SSRF prevention: scheme allowlist, encoded traversal detection<br>• CSP with `wasm-unsafe-eval`, per-user rate limiting |
| **[accessibility.md](./accessibility.md)** | • WCAG 2.2 compliance: Levels A, AA, AAA targets<br>• Keyboard navigation: arrow keys, +/-, R, Escape<br>• Screen reader support: ARIA labels, live regions<br>• Reduced motion: system preference + user override |
| **[performance.md](./performance.md)** | • Core Web Vitals targets: LCP, FCP, INP<br>• 3D-specific metrics: FPS, draw calls, memory<br>• Bundle optimization: code splitting, lazy loading<br>• Rendering: on-demand vs continuous |
| **[diagram.md](./diagram.md)** | • System architecture overview (ASCII art)<br>• File structure with annotations<br>• Upload data flow (validation pipeline)<br>• Model loading flow (cache, scene graph)<br>• Memory management lifecycle<br>• Security validation gates |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 3D Library | Three.js + Threlte v9 | Native Svelte 5 runes support, declarative components |
| File Format | glTF 2.0 Binary (.glb) | ISO standard, web-optimized, single-file |
| Compression | Draco + Basis Universal | 90-95% geometry reduction, universal texture support |
| Storage | Content-addressable R2 | Deduplication, CDN edge caching |
| Metadata | PostgreSQL (Drizzle) | ACID transactions, Better Auth integration |
| Relationships | Neo4j (optional) | Model collections, tags, recommendations |

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.175.0",
    "@threlte/core": "^9.0.0",
    "@threlte/extras": "^9.0.0"
  },
  "devDependencies": {
    "@types/three": "^0.175.0",
    "@gltf-transform/cli": "^4.0.0"
  }
}
```

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| LCP | ≤ 2.5s | ≤ 4.0s |
| FCP | ≤ 1.8s | ≤ 3.0s |
| INP | ≤ 200ms | ≤ 500ms |
| Initial JS | < 170KB gzip | |
| 3D Chunk | < 250KB gzip | Lazy-loaded |
| Desktop FPS | 60 | 30 minimum |
| Mobile FPS | 30+ | 24 minimum |
| Draw Calls | < 100/frame | |
| Polygons | 50-100K/model | 250K max |
| File Size | < 2MB compressed | 10MB max |
