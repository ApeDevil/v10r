// The desk is a complex interactive workspace (split-panel layout, drag-and-drop,
// live AI streaming, file tree, spreadsheet) with no meaningful SSR benefit.
// Disabling SSR here is what makes module-level $state in the dock's .svelte.ts
// files safe: those modules only ever run in the browser, so their state is
// per-tab rather than shared across server requests.
export const ssr = false;
