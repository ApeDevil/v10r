// Composite component exports.
//
// chatbot/ and info-dialog/ are intentionally excluded — they import the markdown
// sanitiser. Keeping them out of the default barrel stops the chat/markdown graph
// being pulled into every route's import graph. (The same exclusion also kept
// jsdom, via isomorphic-dompurify, from breaking Vercel/Node 22 with
// ERR_REQUIRE_ESM before the swap to sanitize-html.)
// Callers must import them directly: `$lib/components/composites/chatbot`,
// `$lib/components/composites/info-dialog`.

export * from './alert';
export * from './altcha';
export * from './back-link';
export * from './boundary-fallback';
export * from './card';
export * from './command';
export * from './command-palette';
export * from './confirm-dialog';
export * from './context-menu';
export * from './diag-grid';
export * from './dock';
export * from './dropdown-menu';
export * from './empty-state';
export * from './error-display';
export * from './feedback-band';
export * from './form-field';
export * from './gallery-card';
export * from './link-card';
export * from './locale-fallback-banner';
export * from './menu-bar';
export * from './nav-grid';
export * from './nav-section';
export * from './nav-tab';
export * from './notifications';
export * from './page-header';
export * from './pagination';
export * from './reorderable-panes';
export * from './selection-bar';
export * from './showcase-docs';
export * from './showcase-layout';
export * from './step-up-dialog';
export * from './tag-input';
export * from './toast';
