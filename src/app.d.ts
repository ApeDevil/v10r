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
			user: import('better-auth').User | null;
			session: import('better-auth').Session | null;
			style: import('$lib/styles/random/types').ResolvedStyle;
			customPaletteColors?: { light: Record<string, string>; dark: Record<string, string> };
			customPaletteAccentOffset?: number;
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
