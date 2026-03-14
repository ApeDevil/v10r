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
		}
		// interface PageData {}
		interface PageState {
			viewerOpen?: boolean;
			modelId?: string;
		}
		// interface Platform {}
	}
}

export {};
