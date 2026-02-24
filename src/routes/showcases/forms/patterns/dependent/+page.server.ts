import type { PageServerLoad, Actions } from './$types';
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { dependentSchema } from '$lib/schemas/forms-showcase/patterns';

const locationData = {
	US: {
		label: 'United States',
		states: {
			CA: { label: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego'] },
			NY: { label: 'New York', cities: ['New York City', 'Buffalo', 'Albany'] },
			TX: { label: 'Texas', cities: ['Houston', 'Austin', 'Dallas'] },
		},
	},
	DE: {
		label: 'Germany',
		states: {
			BY: { label: 'Bavaria', cities: ['Munich', 'Nuremberg', 'Augsburg'] },
			BE: { label: 'Berlin', cities: ['Berlin'] },
			HH: { label: 'Hamburg', cities: ['Hamburg'] },
		},
	},
	JP: {
		label: 'Japan',
		states: {
			TK: { label: 'Tokyo', cities: ['Shinjuku', 'Shibuya', 'Minato'] },
			OS: { label: 'Osaka', cities: ['Osaka', 'Sakai', 'Higashiosaka'] },
			KY: { label: 'Kyoto', cities: ['Kyoto', 'Uji', 'Kameoka'] },
		},
	},
};

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(dependentSchema));
	return { form, locationData };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, valibot(dependentSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		return message(form, `Location selected: ${form.data.city}, ${form.data.state}, ${form.data.country}.`);
	},
};
