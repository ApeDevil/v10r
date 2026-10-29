import { error } from '@sveltejs/kit';
import { renderWorkflowTutorial } from '#lib/server/workflows/index.ts';

export const load = async ({ params, locals }) => {
	const rendered = await renderWorkflowTutorial(params.slug, locals.locale);
	if (!rendered) throw error(404, 'Workflow not found');
	return {
		title: `${rendered.card.title()} — Workflows`,
		slug: rendered.card.slug,
		html: rendered.html,
		toc: rendered.toc,
	};
};
