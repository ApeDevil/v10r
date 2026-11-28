import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { registryDigest } from '#patterns/registry-digest.ts';
import { splitSkillFile, validateAgentSkillTree } from './agent-skill-spec';
import { AGENT_SKILLS_DIR, agentSkillNameFor, renderAgentSkills, SELECTION_AGENT_SKILL } from './agent-skills';
import { REGISTRY } from './registry';

const generated = renderAgentSkills(REGISTRY);
const SKILLS_ROOT = join(process.cwd(), AGENT_SKILLS_DIR);

function committedTree(): Map<string, string> {
	const tree = new Map<string, string>();
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const abs = join(dir, entry.name);
			if (entry.isDirectory()) walk(abs);
			else tree.set(relative(SKILLS_ROOT, abs).split('\\').join('/'), readFileSync(abs, 'utf8'));
		}
	};
	if (existsSync(SKILLS_ROOT)) walk(SKILLS_ROOT);
	return tree;
}

describe('renderAgentSkills', () => {
	it('renders a spec-valid tree', () => {
		expect(validateAgentSkillTree(generated)).toEqual([]);
	});

	it('is deterministic', () => {
		expect([...renderAgentSkills(REGISTRY)]).toEqual([...generated]);
	});

	it('renders one agent skill per registry group plus the selection entry point', () => {
		const skills = [...generated.keys()].filter((path) => path.endsWith('/SKILL.md')).map((path) => path.split('/')[0]);
		expect(skills).toEqual([SELECTION_AGENT_SKILL, ...REGISTRY.groups.map((group) => agentSkillNameFor(group.id))]);
	});

	it('ships a reference for every deep record, in its group, and none for light records', () => {
		for (const pattern of REGISTRY.patterns) {
			const group = REGISTRY.categories.find((category) => category.id === pattern.category)?.group ?? '';
			const path = `${agentSkillNameFor(group)}/references/${pattern.id}.md`;
			expect(generated.has(path), pattern.id).toBe(pattern.tier === 'deep');
		}
	});

	it('lists every registry pattern in exactly one group index', () => {
		const indexes = REGISTRY.groups.map((group) => generated.get(`${agentSkillNameFor(group.id)}/SKILL.md`) ?? '');
		for (const pattern of REGISTRY.patterns) {
			const marker = pattern.tier === 'deep' ? `(references/${pattern.id}.md)` : `(\`${pattern.id}\`,`;
			expect(indexes.filter((index) => index.includes(marker)).length, pattern.id).toBe(1);
		}
	});

	it('carries deterministic metadata: registry digest, no timestamps', () => {
		for (const [path, content] of generated) {
			if (!path.endsWith('/SKILL.md')) continue;
			const parts = splitSkillFile(content);
			const frontmatter = parseYaml(parts?.frontmatter ?? '') as Record<string, unknown>;
			expect(frontmatter.license).toBe('MIT');
			expect(frontmatter.metadata).toEqual({
				source: 'v10r pattern-library registry',
				'registry-digest': registryDigest(REGISTRY),
				generated: 'true',
			});
		}
	});

	it('references use only portable links — no in-app /docs or relative /showcases URLs', () => {
		for (const [path, content] of generated) {
			if (!path.includes('/references/')) continue;
			expect(content, path).not.toMatch(/\]\(\/(docs|showcases)\//);
		}
	});
});

describe('committed skills/ tree', () => {
	it('matches the registry (run bun run skills:build) and is spec-valid', () => {
		const committed = committedTree();
		expect([...committed.keys()].sort()).toEqual([...generated.keys()].sort());
		for (const [path, content] of generated) expect(committed.get(path), path).toBe(content);
		expect(validateAgentSkillTree(committed)).toEqual([]);
	});
});
