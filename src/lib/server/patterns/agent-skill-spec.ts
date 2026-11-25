/**
 * The Agent Skills format rules (https://agentskills.io/specification), as code.
 *
 * An agent skill is a directory holding a `SKILL.md`: YAML frontmatter (`name`,
 * `description`, optional `license`, `compatibility`, `metadata`, `allowed-tools`)
 * and a Markdown body the agent loads in full when it activates the agent skill. The
 * official checker is the Python `skills-ref` reference library; this is a TypeScript
 * mirror of its rules so the gate needs no Python. (The npm package named `skills-ref`
 * is an unrelated third party's — deliberately not used.)
 *
 * Two of the rules below are the spec's *recommendations* — body under 500 lines and
 * under ~5000 tokens — enforced here as errors: an agent skill generated from the
 * registry has no author to notice it grew, so the budget has to fail loudly.
 *
 * The token budget uses the repo's one estimate (`estimateTokens`, characters / 4 — the
 * desk context budget's): crude on purpose, since the spec's budget is itself approximate
 * and a real tokenizer would tie the gate to one vendor.
 *
 * Pure: no filesystem, no Vite (runs under bare Bun). Callers hand in file maps; the build
 * script (`scripts/agent-skills/build.ts`) and the standalone checker
 * (`scripts/agent-skills/validate.ts`) own the I/O.
 */
import { parse as parseYaml } from 'yaml';
import { estimateTokens } from '#lib/components/desk/desk-context.pure.ts';

export const AGENT_SKILL_FILENAME = 'SKILL.md';
const AGENT_SKILL_NAME_MAX = 64;
const AGENT_SKILL_DESCRIPTION_MAX = 1024;
const AGENT_SKILL_COMPATIBILITY_MAX = 500;
export const AGENT_SKILL_BODY_MAX_LINES = 500;
export const AGENT_SKILL_BODY_MAX_TOKENS = 5000;

const ALLOWED_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** One broken rule: which agent skill, which rule (stable key for tests), and a readable reason. */
export interface AgentSkillIssue {
	skill: string;
	rule: string;
	message: string;
}

/** Split a SKILL.md into its frontmatter text and body; null when there is no `---` block. */
export function splitSkillFile(raw: string): { frontmatter: string; body: string } | null {
	if (!raw.startsWith('---\n')) return null;
	const end = raw.indexOf('\n---\n', 3);
	if (end === -1) return null;
	return { frontmatter: raw.slice(4, end), body: raw.slice(end + 5) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Relative markdown link targets in a body (`[x](references/a.md)`), anchors and URLs excluded. */
function relativeLinkTargets(body: string): string[] {
	const targets: string[] = [];
	for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) {
		const target = match[1].split('#')[0];
		if (target === '' || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
		targets.push(target);
	}
	return targets;
}

/**
 * Validate one agent skill directory.
 *
 * @param dirName the directory's own name (the spec requires `name` to equal it)
 * @param files   path (relative to the agent skill directory) → content, `SKILL.md` included
 */
export function validateAgentSkill(dirName: string, files: ReadonlyMap<string, string>): AgentSkillIssue[] {
	const issues: AgentSkillIssue[] = [];
	const fail = (rule: string, message: string) => issues.push({ skill: dirName, rule, message });

	const raw = files.get(AGENT_SKILL_FILENAME);
	if (raw === undefined) {
		fail('skill-file', `missing ${AGENT_SKILL_FILENAME}`);
		return issues;
	}
	const parts = splitSkillFile(raw);
	if (parts === null) {
		fail('frontmatter', `${AGENT_SKILL_FILENAME} must start with a YAML frontmatter block delimited by ---`);
		return issues;
	}
	let frontmatter: unknown;
	try {
		frontmatter = parseYaml(parts.frontmatter);
	} catch (error) {
		fail('frontmatter', `frontmatter is not valid YAML: ${(error as Error).message.split('\n')[0]}`);
		return issues;
	}
	if (!isPlainObject(frontmatter)) {
		fail('frontmatter', 'frontmatter must be a YAML mapping');
		return issues;
	}

	for (const key of Object.keys(frontmatter)) {
		if (!ALLOWED_FIELDS.has(key)) fail('unexpected-field', `unexpected frontmatter field "${key}"`);
	}

	const name = frontmatter.name;
	if (typeof name !== 'string' || name.length === 0) {
		fail('name', '"name" is required and must be a non-empty string');
	} else {
		if (name.length > AGENT_SKILL_NAME_MAX) fail('name', `"name" exceeds ${AGENT_SKILL_NAME_MAX} characters`);
		if (!NAME_PATTERN.test(name)) {
			fail('name', `"name" must be lowercase a-z, 0-9 and single hyphens, not starting or ending with one: "${name}"`);
		}
		if (name !== dirName) fail('name-matches-dir', `"name" "${name}" must equal its directory name "${dirName}"`);
	}

	const description = frontmatter.description;
	if (typeof description !== 'string' || description.trim().length === 0) {
		fail('description', '"description" is required and must be a non-empty string');
	} else if (description.length > AGENT_SKILL_DESCRIPTION_MAX) {
		fail(
			'description',
			`"description" is ${description.length} characters; the limit is ${AGENT_SKILL_DESCRIPTION_MAX}`,
		);
	}

	if ('license' in frontmatter && typeof frontmatter.license !== 'string') {
		fail('license', '"license" must be a string');
	}
	if ('compatibility' in frontmatter) {
		const compatibility = frontmatter.compatibility;
		if (
			typeof compatibility !== 'string' ||
			compatibility.length === 0 ||
			compatibility.length > AGENT_SKILL_COMPATIBILITY_MAX
		) {
			fail('compatibility', `"compatibility" must be a string of 1-${AGENT_SKILL_COMPATIBILITY_MAX} characters`);
		}
	}
	if ('metadata' in frontmatter) {
		const metadata = frontmatter.metadata;
		if (!isPlainObject(metadata) || !Object.values(metadata).every((value) => typeof value === 'string')) {
			fail('metadata', '"metadata" must map string keys to string values (quote numbers and booleans)');
		}
	}
	if ('allowed-tools' in frontmatter && typeof frontmatter['allowed-tools'] !== 'string') {
		fail('allowed-tools', '"allowed-tools" must be a space-separated string');
	}

	const lines = parts.body.split('\n').length;
	if (lines > AGENT_SKILL_BODY_MAX_LINES) {
		fail(
			'body-lines',
			`body is ${lines} lines; keep it under ${AGENT_SKILL_BODY_MAX_LINES} (move detail to references/)`,
		);
	}
	const tokens = estimateTokens(parts.body);
	if (tokens > AGENT_SKILL_BODY_MAX_TOKENS) {
		fail(
			'body-tokens',
			`body is ~${tokens} tokens (chars/4); keep it under ${AGENT_SKILL_BODY_MAX_TOKENS} (move detail to references/)`,
		);
	}

	for (const target of relativeLinkTargets(parts.body)) {
		const clean = target.replace(/^\.\//, '');
		if (!files.has(clean)) fail('relative-link', `body links "${target}", which is not in the agent skill directory`);
	}
	return issues;
}

/**
 * Validate a tree of agent skills: path relative to the tree root (`<dir>/SKILL.md`,
 * `<dir>/references/x.md`) → content. Top-level files (a README hub) are not agent skills
 * and are ignored; every top-level directory must be a valid agent skill.
 */
export function validateAgentSkillTree(tree: ReadonlyMap<string, string>): AgentSkillIssue[] {
	const byDir = new Map<string, Map<string, string>>();
	for (const [path, content] of tree) {
		const slash = path.indexOf('/');
		if (slash === -1) continue;
		const dir = path.slice(0, slash);
		const files = byDir.get(dir) ?? new Map<string, string>();
		files.set(path.slice(slash + 1), content);
		byDir.set(dir, files);
	}
	return [...byDir].flatMap(([dir, files]) => validateAgentSkill(dir, files));
}
