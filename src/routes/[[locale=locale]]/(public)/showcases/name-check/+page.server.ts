import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { conflictReasonText, nameCheckLabels, resultsForText } from '$lib/name-check/labels';
import { nameCheckFormSchema } from '$lib/schemas/name-check';
import { checkHoneypot, ipLimitKey } from '$lib/server/abuse';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter } from '$lib/server/http/rate-limit';
import { checkName, loadNameSourceCredentials } from '$lib/server/name-check';
import {
	FAN_OUT_BUDGET_MS,
	RATE_LIMIT_MAX,
	RATE_LIMIT_PREFIX,
	RATE_LIMIT_WINDOW,
	RESPONSE_RESERVE_MS,
} from '$lib/server/name-check/config';
import type { Actions, PageServerLoad } from './$types';

/**
 * The name-check form. A POST action rather than a `?q=` load on purpose: the name a
 * visitor types may be an unreleased brand, and a query string ends up in access logs,
 * analytics paths and browser history. The body does not.
 *
 * Same limiter as the JSON route (one prefix, one budget), applied after the honeypot
 * so a bot never spends a human's window.
 */
const limiter = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const load: PageServerLoad = async () => {
	const form = await superValidate(
		{
			query: '',
			territory: 'worldwide',
			category: null,
			nonce: crypto.randomUUID(),
			renderedAt: Date.now(),
			bookmark: '',
		},
		valibot(nameCheckFormSchema),
		// The seeded form is empty by design; validating it would show "required" before anyone typed.
		{ errors: false },
	);
	// Labels resolve here, in the request's locale, so the client ships components rather
	// than a three-language dictionary (see `$lib/name-check/labels`).
	return { title: 'Name Check - Showcases', form, labels: nameCheckLabels() };
};

export const actions: Actions = {
	check: async (event) => {
		const form = await superValidate(event.request, valibot(nameCheckFormSchema));
		if (!form.valid) {
			return fail(400, { form });
		}

		const honeypot = checkHoneypot({ honeypot: form.data.bookmark, renderedAt: form.data.renderedAt });
		if (!honeypot.allowed) {
			// Generic on purpose: it does not teach a bot which check fired.
			return message(form, 'rejected', { status: 400 });
		}

		const { success } = await limiter.limit(ipLimitKey(getClientIp(event)));
		if (!success) {
			return message(form, 'rate_limited', { status: 429 });
		}

		const report = await checkName(form.data, {
			deadline: event.locals.deadline.child(FAN_OUT_BUDGET_MS, { reserveMs: RESPONSE_RESERVE_MS }),
			credentials: await loadNameSourceCredentials(),
		});

		const { sources } = nameCheckLabels();
		return {
			form,
			report,
			headline: resultsForText(report.query.raw),
			reasons: report.signal.reasons.map((reason) => conflictReasonText(reason, sources)),
		};
	},
};
