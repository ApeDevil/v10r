export * from './composites';
export * from './layout';
export * from './primitives';

// viz/ is intentionally excluded — import from '$lib/components/viz' directly
//   to avoid bundling Chart.js/Three.js in the default component surface.
// shell/ is intentionally excluded — app-specific, import from '$lib/components/shell'.
