// Composite component exports.
//
// chatbot/ and info-dialog/ are intentionally excluded — they import the
// markdown sanitiser, which historically pulled `jsdom` (via isomorphic-dompurify)
// and broke Vercel/Node 22 with ERR_REQUIRE_ESM. Even after swapping to
// sanitize-html, keeping these out of the default barrel prevents the chat/markdown
// graph from being unconditionally pulled into every route's import graph.
// Callers must import them directly: `$lib/components/composites/chatbot`,
// `$lib/components/composites/info-dialog`.

export * from './alert';
export * from './back-link';
export * from './boundary-fallback';
export * from './card';
export * from './command';
export * from './command-palette';
export * from './confirm-dialog';
export * from './context-menu';
export * from './date-picker';
export * from './diag-grid';
export * from './dock';
export * from './dropdown-menu';
export * from './empty-state';
export * from './error-display';
export * from './form-field';
export * from './link-card';
export * from './menu-bar';
export * from './nav-grid';
export * from './nav-section';
export * from './nav-tab';
export * from './notifications';
export * from './page-header';
export * from './pagination';
export * from './reorderable-panes';
export * from './selection-bar';
export * from './showcase-layout';
export * from './tag-input';
export * from './toast';
