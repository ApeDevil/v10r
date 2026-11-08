/**
 * The parsed decision catalogue — the one reading of `decisions.json` every consumer shares
 * (the Studio, the overview page, the MCP tools, the tests). Parsing is fail-closed: a broken
 * catalogue throws at import, and `patterns:validate` reports the same errors in the gate.
 */
import {
	type ArchitectureDecision,
	type ArchitectureDecisionCatalog,
	parseDecisionCatalog,
} from './decision-record.ts';
import catalogJson from './decisions.json';

function load(): ArchitectureDecisionCatalog {
	const { catalog, errors } = parseDecisionCatalog(catalogJson);
	if (!catalog) throw new Error(`decisions.json is invalid:\n${errors.join('\n')}`);
	return catalog;
}

export const DECISION_CATALOG: ArchitectureDecisionCatalog = load();

export function findDecision(id: string): ArchitectureDecision | undefined {
	return DECISION_CATALOG.decisions.find((decision) => decision.id === id);
}
