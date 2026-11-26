import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { sanitizeFeedbackErrorId, sanitizeFeedbackRoute, sanitizeFeedbackSource } from '#lib/feedback/source.ts';
import { feedbackSubmissionSchema } from '#lib/feedback/validation.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import { checkHoneypot, ipLimitKey } from '#lib/server/abuse/index.ts';
import {
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	submitFeedback,
	USER_RATE_LIMIT_MAX,
	USER_RATE_LIMIT_PREFIX,
	USER_RATE_LIMIT_WINDOW,
} from '#lib/server/feedback/index.ts';
import { getClientIp } from '#lib/server/http/client-ip.ts';
import { createLimiter } from '#lib/server/http/rate-limit.ts';
import { VERCEL_GIT_COMMIT_SHA } from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';

const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
const userLimiter = createLimiter(USER_RATE_LIMIT_PREFIX, USER_RATE_LIMIT_MAX, USER_RATE_LIMIT_WINDOW);

/** The deployment's commit; '' off Vercel, and then no version is attached. */
const appVersion = VERCEL_GIT_COMMIT_SHA ?? '';

export const load: PageServerLoad = async ({ url, locals }) => {
	const accountEmail = locals.user?.email ?? null;
	// 5xx pages link here with ?err=<errorId>; attaching it (when the submitter agrees) ties
	// the report to the handleError log line without any consent/session dependency.
	const errorId = sanitizeFeedbackErrorId(url.searchParams.get('err'));
	const form = await superValidate(
		{
			category: errorId ? 'bug' : 'general',
			subject: '',
			body: '',
			rating: null,
			contactEmail: accountEmail,
			pageOfOrigin: sanitizeFeedbackSource(url.searchParams.get('from')),
			routeId: sanitizeFeedbackRoute(url.searchParams.get('route')),
			errorId,
			// Off until the submitter ticks it: technical context is attached by their choice.
			includeContext: false,
			nonce: crypto.randomUUID(),
			renderedAt: Date.now(),
			bookmark: '',
		},
		valibot(feedbackSubmissionSchema),
		// A blank form is not a wrong one: no "at least 3 characters" before anyone typed.
		{ errors: false },
	);

	return {
		title: 'Send feedback',
		form,
		emailPrefilled: accountEmail !== null,
		signedIn: locals.user != null,
		// Shown beside the checkbox so the submitter sees exactly what it attaches.
		appVersion,
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, valibot(feedbackSubmissionSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const honeypot = checkHoneypot({ honeypot: form.data.bookmark, renderedAt: form.data.renderedAt });
		if (!honeypot.allowed) {
			// Deliberately generic: doesn't teach a bot which check fired. A human
			// tripped by the speed floor keeps their typed content and can resubmit.
			return message(form, 'rejected', { status: 400 });
		}

		// One limiter call per submission: a signed-in submitter is limited per account (rotating
		// IPs buys nothing), an anonymous one per IP. A null IP falls into ipLimitKey's shared
		// `anon` bucket instead of bypassing the limiter.
		const userId = event.locals.user?.id ?? null;
		const { success } = userId ? await userLimiter.limit(userId) : await limiter.limit(ipLimitKey(getClientIp(event)));
		if (!success) {
			// A form action must return fail()/message() — a raw Response is not
			// devalue-serializable and turns the denial into a 500.
			return message(form, 'rate_limited', { status: 429 });
		}

		const result = await submitFeedback({
			category: form.data.category,
			subject: form.data.subject,
			body: form.data.body,
			rating: form.data.rating ?? null,
			contactEmail: form.data.contactEmail ?? null,
			userId,
			technicalContext: form.data.includeContext
				? {
						pageOfOrigin: form.data.pageOfOrigin,
						routeId: form.data.routeId,
						errorId: form.data.errorId,
						appVersion,
						// The journey link exists only when analytics consent set the cookie.
						sessionId: event.cookies.get('_v10r_sid') ?? null,
					}
				: null,
			nonce: form.data.nonce,
		});

		if (!result.ok) return message(form, 'inbox_full', { status: 503 });

		redirect(303, localizeHref('/feedback/thanks'));
	},
};
