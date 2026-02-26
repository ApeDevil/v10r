/**
 * Theme state management (SSR-safe using context pattern)
 */

import { browser } from '$app/environment';
import { getContext, setContext } from 'svelte';

type ThemeMode = 'light' | 'dark' | 'system';
type AccentColor = 'blue' | 'purple' | 'green' | 'orange';

interface ThemeState {
	mode: ThemeMode;
	accent: AccentColor;
	resolvedMode: 'light' | 'dark'; // Computed from mode + system preference
}

const THEME_CTX = Symbol('theme');

/**
 * Create theme state instance.
 * @param initial - Initial theme settings from server
 */
export function createThemeState(initial: { mode: ThemeMode; accent: AccentColor }) {
	let state = $state<ThemeState>({
		mode: initial.mode,
		accent: initial.accent,
		resolvedMode: 'light',
	});

	// Resolve system preference
	$effect(() => {
		if (!browser) return;

		if (state.mode === 'system') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			state.resolvedMode = mediaQuery.matches ? 'dark' : 'light';

			const handler = (e: MediaQueryListEvent) => {
				state.resolvedMode = e.matches ? 'dark' : 'light';
			};
			mediaQuery.addEventListener('change', handler);
			return () => mediaQuery.removeEventListener('change', handler);
		} else {
			state.resolvedMode = state.mode;
		}
	});

	// Apply to DOM
	$effect(() => {
		if (!browser) return;
		document.documentElement.classList.toggle('dark', state.resolvedMode === 'dark');
		document.documentElement.dataset.accent = state.accent;
	});

	return {
		get mode() {
			return state.mode;
		},
		get accent() {
			return state.accent;
		},
		get resolvedMode() {
			return state.resolvedMode;
		},
		get isDark() {
			return state.resolvedMode === 'dark';
		},

		setMode(mode: ThemeMode) {
			state.mode = mode;
			// Persist to cookie (for SSR)
			if (browser) {
				document.cookie = `theme=${mode};path=/;max-age=31536000;SameSite=Lax`;
			}
			// TODO: Persist to DB via API when user management is implemented
		},

		setAccent(accent: AccentColor) {
			state.accent = accent;
			// TODO: Persist to DB via API when user management is implemented
		},
	};
}

/**
 * Set theme context in component tree.
 * Call this in root layout with initial values from load function.
 */
export function setThemeContext(initial: { mode: ThemeMode; accent: AccentColor }) {
	const theme = createThemeState(initial);
	setContext(THEME_CTX, theme);
	return theme;
}

/**
 * Get theme state from context.
 * Use this in child components.
 */
export function getTheme() {
	return getContext<ReturnType<typeof createThemeState>>(THEME_CTX);
}
