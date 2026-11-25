/**
 * Check any directory of agent skills against the Agent Skills rules
 * (src/lib/server/patterns/agent-skill-spec.ts) and print per-agent-skill sizes.
 *
 *   bun run skills:validate                    # skills/ (the generated pattern-library agent skills)
 *   bun run skills:validate .claude/skills     # any other tree of <name>/SKILL.md directories
 *
 * `skills:check` already validates the generated tree; this is the standalone checker
 * for a tree nobody generated, and the size report (lines, ~tokens) for budgeting.
 */
import { resolve } from 'node:path';
import { estimateTokens } from '../../src/lib/components/desk/desk-context.pure.ts';
import {
	AGENT_SKILL_FILENAME,
	splitSkillFile,
	validateAgentSkillTree,
} from '../../src/lib/server/patterns/agent-skill-spec.ts';
import { readSkillTree } from './skill-tree.ts';

const ROOT = resolve(import.meta.dir, '../..');
const targets = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
let failed = false;

for (const target of targets.length > 0 ? targets : ['skills']) {
	const tree = readSkillTree(resolve(ROOT, target));
	const skills = [...tree.keys()].filter(
		(path) => path.split('/').length === 2 && path.endsWith(`/${AGENT_SKILL_FILENAME}`),
	);
	if (skills.length === 0) {
		console.error(`FAIL ${target}: no <name>/${AGENT_SKILL_FILENAME} found`);
		failed = true;
		continue;
	}
	for (const path of skills) {
		const body = splitSkillFile(tree.get(path) ?? '')?.body ?? '';
		const references = [...tree.keys()].filter((file) => file.startsWith(`${path.split('/')[0]}/references/`)).length;
		console.error(
			`${target}/${path}: ${body.split('\n').length} lines, ~${estimateTokens(body)} tokens, ${references} reference(s)`,
		);
	}
	const issues = validateAgentSkillTree(tree);
	for (const issue of issues) console.error(`FAIL ${target}/${issue.skill}: [${issue.rule}] ${issue.message}`);
	if (issues.length > 0) failed = true;
	else console.error(`${target}: ${skills.length} agent skill(s) valid`);
}

process.exit(failed ? 1 : 0);
