/**
 * Workflow catalog — the single source of truth for the /workflows hub, the nav
 * flyout and the sitemap.
 *
 * A workflow is a step-by-step pattern for real work that doubles as a tutorial:
 * the page teaches it, and the reader repeats it on their own files. Workflows are
 * grouped by category (the hub's sections). Adding a category means one entry in
 * `workflowCategories`; adding a workflow means one entry in `workflows` plus its
 * tutorial at `content/workflows/<category>/<slug>.md`.
 *
 * Copy is stored as Paraglide message-function references (`LabelFn`, the `nav.ts`
 * convention) so consumers resolve the current locale at render time. The tutorial
 * bodies are English-only, like the docs.
 */
import type { LabelFn } from '#lib/nav/types.ts';
import * as m from '#lib/paraglide/messages.js';

/** The hub's sections, in display order. New kinds of work (3D, …) add an id here. */
export type WorkflowCategoryId = 'office';

export interface WorkflowCategory {
	id: WorkflowCategoryId;
	label: LabelFn;
	description: LabelFn;
}

export const workflowCategories: WorkflowCategory[] = [
	{ id: 'office', label: m.workflow_category_office, description: m.workflow_category_office_description },
];

export interface WorkflowCard {
	/** URL key under `/workflows/` and the tutorial's file name. */
	slug: string;
	category: WorkflowCategoryId;
	icon: string;
	title: LabelFn;
	description: LabelFn;
}

export const workflows: WorkflowCard[] = [
	{
		slug: 'excel-product-sheet',
		category: 'office',
		icon: 'i-lucide-sheet',
		title: m.workflow_excel_product_sheet_title,
		description: m.workflow_excel_product_sheet_description,
	},
];

export function workflowHref(card: WorkflowCard): `/workflows/${string}` {
	return `/workflows/${card.slug}`;
}

export function findWorkflow(slug: string): WorkflowCard | undefined {
	return workflows.find((card) => card.slug === slug);
}

/** Categories in hub order, each with its workflows; empty categories are left out. */
export function groupWorkflowsByCategory(): { category: WorkflowCategory; cards: WorkflowCard[] }[] {
	return workflowCategories
		.map((category) => ({ category, cards: workflows.filter((card) => card.category === category.id) }))
		.filter((group) => group.cards.length > 0);
}
