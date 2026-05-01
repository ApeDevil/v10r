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
		}
		interface PageData {
			style: import('$lib/styles/random/types').ResolvedStyle;
		}
		interface PageState {
			viewerOpen?: boolean;
			modelId?: string;
		}
		// interface Platform {}
	}
}

export {};
