// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
			errorId?: string;
		}
		interface Locals {
			user:
				| (import('better-auth').User & { role?: string | null; banned?: boolean | null; banReason?: string | null })
				| null;
			session: import('better-auth').Session | null;
			style: import('$lib/styles/random/types').ResolvedStyle;
			customPaletteColors?: { light: Record<string, string>; dark: Record<string, string> };
			customPaletteAccentOffset?: number;
			/** Analytics consent tier resolved from the v10r_consent cookie. Defaults to 'necessary'. */
			consentTier: import('$lib/server/analytics/consent').ConsentTier;
			/** Admin user id this request is paired to via the debug-owner cookie. NULL when not paired. */
			debugOwnerId: string | null;
			/** Resolved locale for this request. URL > cookie > baseLocale, validated against ALLOWED_LOCALES. */
			locale: import('$lib/i18n').Locale;
		}
		interface PageData {
			style: import('$lib/styles/random/types').ResolvedStyle;
			/** Per-page title fragment. Layout renders `${title} - ${BRAND_NAME}`. Omit on the homepage and the layout falls back to BRAND_NAME alone. */
			title?: string;
		}
		interface PageState {
			viewerOpen?: boolean;
			modelId?: string;
		}
		// interface Platform {}
	}
}

export {};
