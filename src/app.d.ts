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
			// No `role`: admin is the ADMIN_USER_ID env list, never a DB column.
			user:
				| (import('better-auth').User & {
						banned?: boolean | null;
						banReason?: string | null;
						twoFactorEnabled?: boolean | null;
				  })
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
			/** Canonical client IP. Stamped in securityHeaders (handler #2) from event.getClientAddress(). NULL during prerender/build. */
			clientIp: string | null;
			/** Span recorder for this request. Stamped by requestTiming (handler #1), so it is always present; every layer records into it and Server-Timing renders it. */
			timing: import('$lib/server/http/request-timing').RequestTiming;
			/** Latency budget for this request. Downstream work takes `child()` slices of it, never a fresh timeout. */
			deadline: import('$lib/server/http/deadline').Deadline;
			/** Round-trip counter for this request. Stamped by queryCensus (handler #3), so it covers auth's session lookup too. */
			queries: import('$lib/server/db/query-census').QueryCensus;
			/** Active capability grants for the authenticated user. Empty array when signed out or no active grants. Populated by populateGrants hook. */
			grants: import('$lib/server/auth/grants').GrantKind[];
			/** True when session/grant resolution failed (e.g. Neon outage) and the request was degraded to anonymous. Read by an optional future banner; never gates logic. */
			authDegraded?: boolean;
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
