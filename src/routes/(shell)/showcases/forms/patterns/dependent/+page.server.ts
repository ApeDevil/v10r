import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { dependentSchema } from '$lib/schemas/showcase/patterns';
import type { Actions, PageServerLoad } from './$types';

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
