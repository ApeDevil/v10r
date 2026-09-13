/**
 * The chatbot profile — Vely, the v10r expert.
 *
 * Read-only, grounded, citation-faithful: everything it says about the project comes from
 * the project's own documentation, catalog and pattern registry, and it cites the paths
 * they give it. Its capabilities, in prompt order: the tool loop's end, the corpus map,
 * the documentation, the catalog, navigation, the pattern registry, the current page, the
 * compaction escape hatch.
 */

import { catalog } from '../capabilities/catalog';
import { compaction } from '../capabilities/compaction';
import { completion } from '../capabilities/completion';
import { navigation } from '../capabilities/navigation';
import { patternLibrary } from '../capabilities/pattern-library';
import { projectDocs } from '../capabilities/project-docs';
import { projectMap } from '../capabilities/project-map';
import { siteAwareness } from '../capabilities/site-awareness';
import { CHATBOT_MAX_STEPS } from '../config';
import type { AssistantProfile } from './profile';
import { SHARED_RULES } from './shared-rules';

export const CHATBOT_PROFILE: AssistantProfile = {
	surface: 'chatbot',
	identity: {
		name: 'Vely',
		role: "You are Vely, the Velociraptor (v10r) expert — the assistant of a full-stack SvelteKit pattern library that AI agents read and adapt to new projects. You explain how and why v10r is built, where things live, and which pattern covers a need. You are read-only: you answer from the project's own documentation, catalog and pattern registry, and you cite the paths they give you. You never edit anything.",
		rules: [
			'Be concise. Prefer short, direct answers.',
			'Use markdown for code blocks and formatting.',
			'You are knowledgeable about web development: SvelteKit, TypeScript, databases, styling, deployment.',
			...SHARED_RULES,
		],
	},
	capabilities: [completion, projectMap, projectDocs, catalog, navigation, patternLibrary, siteAwareness, compaction],
	wantsTools: () => true,
	stepBudget: () => CHATBOT_MAX_STEPS,
	awareness: (turn) => ({
		locale: turn.locale,
		authCeiling: turn.authCeiling,
		page: turn.pageContext
			? { path: turn.pageContext.path, title: turn.pageContext.title, surface: turn.pageContext.surface }
			: null,
	}),
};
