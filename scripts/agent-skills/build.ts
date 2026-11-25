/**
 * Build (or verify) the pattern library's Agent Skills under `skills/` from
 * `pattern-library/registry.json` (renderer: src/lib/server/patterns/agent-skills.ts).
 *
 *   bun run skills:build     # regenerate skills/ (commit the result)
 *   bun run skills:check     # fail if skills/ is stale, has orphans, or breaks the spec (in the gate)
 *
 * Both modes validate the generated tree against the Agent Skills rules
 * (src/lib/server/patterns/agent-skill-spec.ts) before touching disk, so an invalid
 * agent skill is never written. Determinism mirrors scripts/patterns/build-derived.ts:
 * registry order, no timestamps, byte-stable; a file under skills/ that the registry
 * no longer produces is an orphan — deleted on build, a failure on --check.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { validateAgentSkillTree } from '../../src/lib/server/patterns/agent-skill-spec.ts';
import { AGENT_SKILLS_DIR, renderAgentSkills } from '../../src/lib/server/patterns/agent-skills.ts';
import { REGISTRY } from '../../src/lib/server/patterns/registry.ts';
import { readSkillTree } from './skill-tree.ts';

const ROOT = resolve(import.meta.dir, '../..');
const OUT = resolve(ROOT, AGENT_SKILLS_DIR);
const CHECK = process.argv.includes('--check');

const generated = renderAgentSkills(REGISTRY);
const onDisk = readSkillTree(OUT);

const issues = validateAgentSkillTree(generated);
if (issues.length > 0) {
	for (const issue of issues) console.error(`FAIL ${issue.skill}: [${issue.rule}] ${issue.message}`);
	console.error('The registry renders an invalid agent skill — fix the renderer or the registry text.');
	process.exit(1);
}

const stale = [...generated].filter(([path, content]) => onDisk.get(path) !== content);
const orphans = [...onDisk.keys()].filter((path) => !generated.has(path));
const skillCount = [...generated.keys()].filter((path) => path.endsWith('/SKILL.md')).length;

if (CHECK) {
	if (stale.length > 0 || orphans.length > 0) {
		for (const [path] of stale) console.error(`FAIL stale: ${AGENT_SKILLS_DIR}/${path}`);
		for (const path of orphans)
			console.error(`FAIL orphaned: ${AGENT_SKILLS_DIR}/${path} (not generated from the registry)`);
		console.error('Regenerate: bun run skills:build');
		process.exit(1);
	}
	console.error(`agent skills OK: ${skillCount} agent skill(s), ${generated.size} file(s) in sync and spec-valid`);
} else {
	for (const [path, content] of stale) {
		const abs = resolve(OUT, path);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, content);
	}
	for (const path of orphans) rmSync(resolve(OUT, path));
	// Drop directories the orphan sweep emptied (a group or reference folder that left the registry).
	for (const path of orphans) {
		let dir = dirname(resolve(OUT, path));
		while (dir !== OUT && existsSync(dir) && readdirSync(dir).length === 0) {
			rmSync(dir, { recursive: true });
			dir = dirname(dir);
		}
	}
	console.error(
		`wrote ${stale.length} changed file(s) of ${generated.size} (${skillCount} agent skills) to ${relative(ROOT, OUT)}/, removed ${orphans.length} orphan(s)`,
	);
}
