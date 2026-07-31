import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { sanitizeFeedbackSource } from '$lib/feedback/source';
import { feedbackSubmissionSchema } from '$lib/feedback/validation';
import { localizeHref } from '$lib/i18n';
import { checkHoneypot, getClientIp, ipLimitKey } from '$lib/server/abuse';
import { createLimiter } from '$lib/server/api/rate-limit';
import { FEEDBACK_RATE_LIMIT_MAX, FEEDBACK_RATE_LIMIT_PREFIX, FEEDBACK_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { submitFeedback } from '$lib/server/feedback';
import type { Actions, PageServerLoad } from './$types';

const limiter = createLimiter(FEEDBACK_RATE_LIMIT_PREFIX, FEEDBACK_RATE_LIMIT_MAX, FEEDBACK_RATE_LIMIT_WINDOW);

export const load: PageServerLoad = async ({ url, locals }) => {
	const accountEmail = locals.user?.email ?? null;
	// 5xx pages link here with ?err=<errorId>; prefilling it ties the report to
	// the handleError log line without any consent/session dependency.
	const rawErr = url.searchParams.get('err');
	const errorId = rawErr && /^[\w-]{1,64}$/.test(rawErr) ? rawErr : null;
	const form = await superValidate(
		{
			subject: '',
			body: errorId ? `Error ID: ${errorId}\n\n` : '',
			rating: null,
			contactEmail: accountEmail,
			pageOfOrigin: sanitizeFeedbackSource(url.searchParams.get('from')),
			nonce: crypto.randomUUID(),
			renderedAt: Date.now(),
			bookmark: '',
		},
		valibot(feedbackSubmissionSchema),
	);

	return { title: 'Send feedback', form, emailPrefilled: accountEmail !== null };
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

		// No `if (ip)` gate: a null IP falls into ipLimitKey's shared `anon` bucket
		// instead of bypassing the limiter entirely.
		const { success } = await limiter.limit(ipLimitKey(getClientIp(event)));
		if (!success) {
			// A form action must return fail()/message() — a raw Response is not
			// devalue-serializable and turns the denial into a 500.
			return message(form, 'rate_limited', { status: 429 });
		}

		// Link to journey if user has consented to analytics
		const sessionId = event.cookies.get('_v10r_sid') ?? null;

		await submitFeedback({
			subject: form.data.subject,
			body: form.data.body,
			rating: form.data.rating,
			contactEmail: form.data.contactEmail,
			pageOfOrigin: form.data.pageOfOrigin,
			sessionId,
			nonce: form.data.nonce,
		});

		redirect(303, localizeHref('/feedback/thanks'));
	},
};
