/**
 * pattern-library — the canonical pattern registry (the same data both MCP runtimes serve),
 * searched through `search_pattern_library`; its `/docs/pattern-library/<id>` pages are
 * citable paths, so the tool feeds the turn's surfaced-catalog rows like the catalog does.
 */
import { type AssistantCapability, catalogSink } from '../profile/profile';
import { createSearchPatternLibraryTool } from '../tools/search-pattern-library';

export const patternLibrary: AssistantCapability = {
	id: 'pattern-library',
	when: 'tools are mounted this turn',
	guidance:
		'To find which v10r PATTERN covers a capability (and the invariants to preserve when emulating it), call `search_pattern_library`; cite its `/docs/pattern-library/<id>` page.',
	sources: ['pattern-library'],
	activates: (turn) =>
		turn.hasTools ? { active: true } : { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' },
	tools: (turn, state) => createSearchPatternLibraryTool(turn.locale, catalogSink(state, 'pattern-library')),
};
