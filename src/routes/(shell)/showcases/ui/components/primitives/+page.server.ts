import type { PageServerLoad } from './$types';
import { highlight } from '$lib/server/shiki';

import ButtonSource from '$lib/components/primitives/button/Button.svelte?raw';
import ButtonVariants from '$lib/components/primitives/button/button.ts?raw';
import SpinnerSource from '$lib/components/primitives/spinner/Spinner.svelte?raw';

export const prerender = true;

export const load: PageServerLoad = async () => {
	const [buttonHtml, buttonVariantsHtml, spinnerHtml] = await Promise.all([
		highlight(ButtonSource, 'svelte'),
		highlight(ButtonVariants, 'typescript'),
		highlight(SpinnerSource, 'svelte'),
	]);

	return {
		sources: {
			button: { html: buttonHtml, language: 'svelte', filename: 'Button.svelte' },
			buttonVariants: {
				html: buttonVariantsHtml,
				language: 'typescript',
				filename: 'button.ts',
			},
			spinner: { html: spinnerHtml, language: 'svelte', filename: 'Spinner.svelte' },
		},
	};
};
