import { describe, expect, it } from 'vitest';
import {
	AGENT_SKILL_BODY_MAX_LINES,
	AGENT_SKILL_BODY_MAX_TOKENS,
	validateAgentSkill,
	validateAgentSkillTree,
} from './agent-skill-spec';

function skillFile(frontmatter: string, body = '# Title\n\nDo the thing.\n'): Map<string, string> {
	return new Map([['SKILL.md', `---\n${frontmatter}\n---\n${body}`]]);
}

const VALID = 'name: pdf-tools\ndescription: Extract PDF text. Use when handling PDFs.';

function rules(dir: string, files: Map<string, string>): string[] {
	return validateAgentSkill(dir, files).map((issue) => issue.rule);
}

describe('validateAgentSkill — the Agent Skills rules', () => {
	it('accepts a minimal valid agent skill and one with every optional field', () => {
		expect(rules('pdf-tools', skillFile(VALID))).toEqual([]);
		const full = `${VALID}\nlicense: MIT\ncompatibility: Requires git\nallowed-tools: Read Bash(git:*)\nmetadata:\n  author: me\n  version: "1.0"`;
		expect(rules('pdf-tools', skillFile(full))).toEqual([]);
	});

	it('rejects a name that does not match its directory', () => {
		expect(rules('other-dir', skillFile(VALID))).toEqual(['name-matches-dir']);
	});

	it('rejects uppercase, leading/trailing and double hyphens, and over-long names', () => {
		for (const name of ['PDF-Tools', '-pdf', 'pdf-', 'pdf--tools', 'pdf_tools']) {
			expect(rules(name, skillFile(`name: ${name}\ndescription: x`)), name).toContain('name');
		}
		const long = 'a'.repeat(65);
		expect(rules(long, skillFile(`name: ${long}\ndescription: x`))).toEqual(['name']);
		const max = 'a'.repeat(64);
		expect(rules(max, skillFile(`name: ${max}\ndescription: x`))).toEqual([]);
	});

	it('rejects a missing, empty or too-long description', () => {
		expect(rules('pdf-tools', skillFile('name: pdf-tools'))).toEqual(['description']);
		expect(rules('pdf-tools', skillFile('name: pdf-tools\ndescription: ""'))).toEqual(['description']);
		const long = 'x'.repeat(1025);
		expect(rules('pdf-tools', skillFile(`name: pdf-tools\ndescription: ${long}`))).toEqual(['description']);
		expect(rules('pdf-tools', skillFile(`name: pdf-tools\ndescription: ${'x'.repeat(1024)}`))).toEqual([]);
	});

	it('rejects unexpected fields, non-string metadata values and an over-long compatibility', () => {
		expect(rules('pdf-tools', skillFile(`${VALID}\nversion: 2`))).toEqual(['unexpected-field']);
		expect(rules('pdf-tools', skillFile(`${VALID}\nmetadata:\n  generated: true`))).toEqual(['metadata']);
		expect(rules('pdf-tools', skillFile(`${VALID}\ncompatibility: ${'c'.repeat(501)}`))).toEqual(['compatibility']);
	});

	it('rejects a body over the line or token budget', () => {
		const tooManyLines = 'line\n'.repeat(AGENT_SKILL_BODY_MAX_LINES + 1);
		expect(rules('pdf-tools', skillFile(VALID, tooManyLines))).toEqual(['body-lines']);
		const tooManyTokens = 'x'.repeat(AGENT_SKILL_BODY_MAX_TOKENS * 4 + 4);
		expect(rules('pdf-tools', skillFile(VALID, tooManyTokens))).toEqual(['body-tokens']);
	});

	it('rejects a missing SKILL.md, missing frontmatter and invalid YAML', () => {
		expect(rules('pdf-tools', new Map())).toEqual(['skill-file']);
		expect(rules('pdf-tools', new Map([['SKILL.md', '# no frontmatter']]))).toEqual(['frontmatter']);
		expect(rules('pdf-tools', skillFile('name: [unclosed'))).toEqual(['frontmatter']);
	});

	it('rejects a relative link to a file the agent skill does not ship, and accepts one it does', () => {
		const body = 'See [the card](references/card.md) and [the spec](https://agentskills.io).\n';
		expect(rules('pdf-tools', skillFile(VALID, body))).toEqual(['relative-link']);
		const withRef = skillFile(VALID, body);
		withRef.set('references/card.md', '# Card');
		expect(rules('pdf-tools', withRef)).toEqual([]);
	});
});

describe('validateAgentSkillTree', () => {
	it('validates every top-level directory and ignores top-level files', () => {
		const tree = new Map([
			['README.md', '# hub — not an agent skill'],
			['pdf-tools/SKILL.md', `---\n${VALID}\n---\nbody\n`],
			['Bad/SKILL.md', '---\nname: Bad\ndescription: x\n---\nbody\n'],
		]);
		const issues = validateAgentSkillTree(tree);
		expect(issues.map((issue) => `${issue.skill}:${issue.rule}`)).toEqual(['Bad:name']);
	});
});
