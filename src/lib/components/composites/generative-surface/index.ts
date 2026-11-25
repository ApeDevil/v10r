// Deep-import only (not in the composites barrel): the lazy wrapper is light, but a page that
// can show a generative surface should say so by importing it from here.
//
// `LazyGenerativeSurface` is the entry pages use. `GenerativeSurface` (the heavy renderer,
// with web_core) and the session stay unexported so nothing pulls them into an eager chunk;
// tests and the bench import them by file.

export { default as LazyGenerativeSurface } from './LazyGenerativeSurface.svelte';
export { DEFAULT_GENERATIVE_SURFACE_LABELS, type GenerativeSurfaceLabels } from './labels.ts';
export { localizedGenerativeSurfaceLabels } from './localized-labels.ts';
export type { GenerativeSurfaceInput } from './surface-session.svelte.ts';
