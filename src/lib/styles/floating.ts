import { cva } from 'class-variance-authority';

/**
 * Shared geometry base for anchored floating content (menus, popovers, pickers).
 *
 * Geometry ONLY — appearance (background, border-color, box-shadow) comes from the
 * `data-elevation` attribute stamped on the same element ([data-elevation] block in
 * app.css). Border WIDTH and radius stay here.
 *
 * Viewport contract: the width cap guarantees the box fits a 320px viewport with an
 * 8px gutter each side even before Floating UI positions it. Max-HEIGHT must stay
 * per-consumer — the Bits available-height var name differs per component
 * (`--bits-<component>-content-available-height`); always give it a fallback.
 */
export const floatingContentBase = cva(['rounded-md border', 'max-w-[calc(100vw-1rem)]', 'overflow-y-auto']);
