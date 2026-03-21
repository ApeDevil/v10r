// src/lib/styles/tokens.ts

// ═══════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════

/** Media query breakpoints (min-width) */
export const breakpoints = {
	sm: '640px', // Large phones landscape
	md: '768px', // Tablets
	lg: '1024px', // Small laptops
	xl: '1280px', // Desktops
	'2xl': '1536px', // Large screens
} as const;

/** Container query breakpoints */
export const containers = {
	xs: '320px',
	sm: '384px',
	md: '448px',
	lg: '512px',
	xl: '576px',
} as const;

// ═══════════════════════════════════════════════════════════════
// FLUID TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════

/**
 * Fluid font sizes using clamp().
 * All values include rem in preferred calculation for WCAG 1.4.4 zoom compliance.
 * Rule: max ≤ 2.5× min to ensure 200% zoom works.
 */
export const fontSize = {
	'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', // Captions
	'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.25vw, 1rem)', // Small text
	'fluid-base': 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)', // Body
	'fluid-lg': 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)', // Lead
	'fluid-xl': 'clamp(1.25rem, 1rem + 1vw, 1.5rem)', // H4
	'fluid-2xl': 'clamp(1.5rem, 1.2rem + 1.5vw, 2rem)', // H3
	'fluid-3xl': 'clamp(1.875rem, 1.5rem + 2vw, 2.5rem)', // H2
	'fluid-4xl': 'clamp(2.25rem, 1.5rem + 3vw, 3.5rem)', // H1
	'fluid-5xl': 'clamp(3rem, 2rem + 4vw, 5rem)', // Display
} as const;

// ═══════════════════════════════════════════════════════════════
// ICON SIZES
// ═══════════════════════════════════════════════════════════════

/**
 * Standard icon sizes.
 * Use text-icon-* classes for consistent sizing.
 * Never use arbitrary sizes like text-[1.75rem].
 */
export const iconSize = {
	'icon-sm': '1rem', // 16px - Inline text, small buttons, dense UI
	'icon-md': '1.25rem', // 20px - Form inputs, triggers, medium buttons
	'icon-lg': '1.5rem', // 24px - Navigation, standard buttons (most common)
	'icon-xl': '2rem', // 32px - Section headers, decorative
} as const;

// ═══════════════════════════════════════════════════════════════
// FIXED & FLUID SPACING
// ═══════════════════════════════════════════════════════════════

/**
 * Fixed spacing scale (8px base).
 * Use for component padding, gaps, margins.
 * Industry standard: Carbon, Material, Atlassian.
 */
export const fixedSpacing = {
	'0': '0',
	'1': '0.125rem', // 2px  - Hairline
	'2': '0.25rem', // 4px  - Tight
	'3': '0.5rem', // 8px  - Input padding, dense lists
	'4': '0.75rem', // 12px - Button horizontal padding
	'5': '1rem', // 16px - Default padding, form gaps
	'6': '1.5rem', // 24px - Comfortable card padding
	'7': '2rem', // 32px - Section spacing
	'8': '3rem', // 48px - Large sections
} as const;

/** Fluid spacing for page-level layout (scales with viewport) */
export const fluidSpacing = {
	'fluid-1': 'clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)', // Tight
	'fluid-2': 'clamp(0.5rem, 0.4rem + 0.5vw, 1rem)', // Small
	'fluid-3': 'clamp(0.75rem, 0.5rem + 1vw, 1.5rem)', // Medium
	'fluid-4': 'clamp(1rem, 0.75rem + 1.5vw, 2rem)', // Default
	'fluid-5': 'clamp(1.5rem, 1rem + 2vw, 3rem)', // Large
	'fluid-6': 'clamp(2rem, 1.5rem + 2.5vw, 4rem)', // XL
	'fluid-7': 'clamp(3rem, 2rem + 4vw, 6rem)', // Section
	'fluid-8': 'clamp(4rem, 3rem + 5vw, 8rem)', // Hero
} as const;

/** Combined spacing (fixed + fluid) for UnoCSS theme */
export const spacing = {
	...fixedSpacing,
	...fluidSpacing,
} as const;

// ═══════════════════════════════════════════════════════════════
// FONT FAMILY
// ═══════════════════════════════════════════════════════════════

/** Font family tokens (CSS variable references, set by data-typography attribute) */
export const fontFamily = {
	heading: 'var(--font-heading, system-ui, sans-serif)',
	body: 'var(--font-body, system-ui, sans-serif)',
	mono: 'var(--font-mono, ui-monospace, monospace)',
} as const;

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════

/**
 * Semantic color tokens (CSS variable references).
 *
 * Single source of truth: src/app.css
 * This file only references CSS variables - actual values live in app.css.
 *
 * WCAG AA contrast ratios (verified in app.css):
 * - fg on bg: 15.3:1 (light), 13.5:1 (dark) ✓
 * - muted on bg: 4.6:1 (light), 4.5:1 (dark) ✓
 * - primary on white: 4.5:1 ✓
 */
export const colors = {
	bg: 'var(--color-bg)',
	fg: 'var(--color-fg)',
	body: 'var(--color-body)',
	heading: 'var(--color-heading)',
	muted: 'var(--color-muted)',
	border: 'var(--color-border)',
	subtle: 'var(--color-subtle)',
	primary: {
		DEFAULT: 'var(--color-primary)',
		hover: 'var(--color-primary-hover)',
		container: 'var(--color-primary-container)',
		dim: 'var(--color-primary-dim)',
	},
	'on-primary': {
		DEFAULT: 'var(--color-on-primary)',
		container: 'var(--color-on-primary-container)',
	},
	secondary: {
		DEFAULT: 'var(--color-secondary)',
	},
	'on-secondary': 'var(--color-on-secondary)',
	success: {
		DEFAULT: 'var(--color-success)',
		light: 'var(--color-success-light)',
	},
	warning: {
		DEFAULT: 'var(--color-warning)',
		hover: 'var(--color-warning-hover)',
		light: 'var(--color-warning-light)',
	},
	error: {
		DEFAULT: 'var(--color-error)',
		light: 'var(--color-error-light)',
		border: 'var(--color-error-border)',
	},
	info: {
		DEFAULT: 'var(--color-info)',
		light: 'var(--color-info-light)',
	},
	input: {
		DEFAULT: 'var(--color-input)',
		border: 'var(--color-input-border)',
	},
	// Semi-transparent variants (derived via color-mix in app.css)
	bgAlpha: 'var(--color-bg-alpha)',
	fgAlpha: 'var(--color-fg-alpha)',
	// Elevation surfaces (higher number = higher elevation)
	surface: {
		1: 'var(--surface-1)', // Raised - cards, panels
		2: 'var(--surface-2)', // Overlay - dropdowns, popovers
		3: 'var(--surface-3)', // Modal - highest elevation
	},
} as const;

// ═══════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════

/** Border radius tokens (CSS variable references, set by data-radius attribute) */
export const borderRadius = {
	sm: 'var(--radius-sm)',
	md: 'var(--radius-md)',
	lg: 'var(--radius-lg)',
	xl: 'var(--radius-xl)',
	full: 'var(--radius-full)',
} as const;

// ═══════════════════════════════════════════════════════════════
// Z-INDEX
// ═══════════════════════════════════════════════════════════════

/** Z-index layers for stacking context */
export const zIndex = {
	base: 0,
	sidebar: 10,
	fab: 20,
	overlay: 30,
	drawer: 40,
	popover: 50,
	dropdown: 50,
	modal: 60,
	toast: 70,
	tooltip: 80,
} as const;

// ═══════════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════════

/** Sidebar dimensions */
export const sidebar = {
	railWidth: '56px',
	expandedWidth: '240px',
	mobileWidth: 'min(320px, 85vw)',
} as const;

/** Content constraints */
export const layout = {
	maxWidth: '80rem', // 1280px - main content max
	contentWidth: '65ch', // Optimal reading width
	wideWidth: '90rem', // 1440px - wide layouts
	narrowWidth: '50rem', // 800px - docs/showcase pages
} as const;

// ═══════════════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════════════

/** Duration values */
export const duration = {
	instant: '0ms', // Immediate, no animation
	fast: '150ms', // Micro-interactions, hovers
	normal: '250ms', // Standard transitions
	slow: '400ms', // Emphasized transitions
	slower: '600ms', // Page transitions, modals
} as const;
