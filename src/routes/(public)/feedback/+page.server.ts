import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { feedbackSubmissionSchema } from '$lib/feedback/validation';
import { localizeHref } from '$lib/i18n';
import { checkHoneypot, getClientIp } from '$lib/server/abuse';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { FEEDBACK_RATE_LIMIT_MAX, FEEDBACK_RATE_LIMIT_PREFIX, FEEDBACK_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { submitFeedback } from '$lib/server/feedback';
import type { Actions, PageServerLoad } from './$types';

const limiter = createLimiter(FEEDBACK_RATE_LIMIT_PREFIX, FEEDBACK_RATE_LIMIT_MAX, FEEDBACK_RATE_LIMIT_WINDOW);

export const load: PageServerLoad = async ({ url }) => {
	const form = await superValidate(
		{
			subject: '',
			body: '',
			rating: null,
			contactEmail: null,
			pageOfOrigin: url.searchParams.get('from') ?? '/',
			nonce: crypto.randomUUID(),
			renderedAt: Date.now(),
			bookmark: '',
		},
		valibot(feedbackSubmissionSchema),
	);

	return { title: 'Send feedback', form };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event.request, valibot(feedbackSubmissionSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const honeypot = checkHoneypot({ honeypot: form.data.bookmark, renderedAt: form.data.renderedAt });
		if (!honeypot.allowed) {
			return fail(400, { form });
		}

		const ip = getClientIp(event);
		if (ip) {
			const { success, reset } = await limiter.limit(ip);
			if (!success) {
				return rateLimitResponse(reset, 'Too many submissions. Please try again later.');
			}
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
