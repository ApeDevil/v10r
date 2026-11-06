/**
 * Latent Card — the engagement model.
 *
 * A latent card has two looks and one capability: at rest its actions are neutral, when
 * the card is *engaged* they take their colour. Engagement changes emphasis, never what
 * the user can do — a resting action is a real, enabled control.
 *
 * Hover and keyboard focus engage the card through CSS (`:hover` under `(hover: hover)`,
 * `:focus-within`), so they work before hydration and need no state. The one signal CSS
 * cannot express is a touch tap on the card's surface, which pins the card engaged until
 * the user dismisses it. That pin is the only state, and this module is its rule.
 */

/** One action a latent card offers. Rendered as a `Button`; never disabled at rest. */
export interface LatentCardAction {
	/** Stable key within the card. */
	id: string;
	/** Visible text, and the accessible name of an icon-only action. */
	label: string;
	/** UnoCSS icon class, e.g. `i-lucide-share-2`. */
	icon?: string;
	/** Renders the action as a link. */
	href?: string;
	onSelect?: () => void;
	/** The colour the action takes when the card is engaged. */
	tone?: LatentActionTone;
}

/** `primary` marks the card's main action; `danger` a destructive one. */
export type LatentActionTone = 'neutral' | 'primary' | 'danger';

/**
 * Where the actions sit: a `footer` bar with labels, or a `corner` cluster of icon-only
 * actions in the header (labels become the accessible name and tooltip).
 */
export type LatentActionPlacement = 'footer' | 'corner';

/**
 * What can change the touch pin.
 * - `surface-tap`: a touch or pen tap on the card outside any interactive control
 * - `outside-tap`: a pointer down anywhere outside the card
 * - `escape`: the Escape key inside the card
 */
export type LatentCardSignal = 'surface-tap' | 'outside-tap' | 'escape';

/** The next pin after `signal`. A surface tap toggles; anything else releases. */
export function nextPinned(pinned: boolean, signal: LatentCardSignal): boolean {
	if (signal === 'surface-tap') return !pinned;
	return false;
}

/**
 * Whether a pointer down counts as a surface tap. Only touch and pen pin: a mouse
 * already engages the card through hover, and pinning it too would leave the card
 * engaged after the pointer leaves. A tap that lands on a control belongs to that
 * control and leaves the pin alone.
 */
export function isSurfaceTap(pointerType: string, onInteractiveControl: boolean): boolean {
	return (pointerType === 'touch' || pointerType === 'pen') && !onInteractiveControl;
}

/** Elements whose taps belong to themselves, not to the card's surface. */
export const INTERACTIVE_SELECTOR =
	'a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="slider"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
