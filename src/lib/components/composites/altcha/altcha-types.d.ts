// Local mirror of altcha's WidgetAttributes (altcha/dist/types/svelte.d.ts):
// the element is loaded via a dynamic import in onMount, so altcha's own global
// svelteHTML declaration never enters the program. altcha v3 renamed
// `challengeurl` to `challenge` (a URL or an inline challenge object) — see
// docs/blueprint/abuse/captcha.md.
declare namespace svelteHTML {
	interface IntrinsicElements {
		'altcha-widget': {
			challenge?: string;
			name?: string;
			hidefooter?: string;
			hidelogo?: string;
			strings?: string;
			class?: string;
			'data-test'?: string;
			ref?: HTMLElement;
		};
	}
}
