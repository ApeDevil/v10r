// Export all primitives
export * from './primitives';

// Export all composites
export * from './composites';

// Export layout primitives
export * from './layout';

// Note: viz/ is intentionally excluded — import from '$lib/components/viz' directly
//       to avoid bundling Chart.js/Three.js in the default component surface.
// Note: shell/ is intentionally excluded — app-specific, import from '$lib/components/shell'.
