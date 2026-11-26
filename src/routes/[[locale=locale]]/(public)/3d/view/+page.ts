// The model lives in the URL fragment, which never reaches a server: there is nothing to render
// on one. The kernel is WebAssembly in a Web Worker, so the page is client-only.
export const ssr = false;
export const load = () => ({ title: '3D Model Viewer' });
