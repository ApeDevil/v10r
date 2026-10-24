import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { sanitizeFeedbackSource } from '#lib/feedback/source.ts';
import { feedbackSubmissionSchema } from '#lib/feedback/validation.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import { checkHoneypot, ipLimitKey } from '#lib/server/abuse/index.ts';
import { RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW } from '#lib/server/feedback/config.ts';
import { submitFeedback } from '#lib/server/feedback/index.ts';
import { getClientIp } from '#lib/server/http/client-ip.ts';
import { createLimiter } from '#lib/server/http/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

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
			rating: form.data.rating ?? null,
			contactEmail: form.data.contactEmail ?? null,
			pageOfOrigin: form.data.pageOfOrigin,
			sessionId,
			nonce: form.data.nonce,
		});

		redirect(303, localizeHref('/feedback/thanks'));
	},
};
