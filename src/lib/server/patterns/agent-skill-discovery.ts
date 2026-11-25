/**
 * Agent Skills discovery — the generated agent skills served over HTTP, so any agent that
 * speaks the Agent Skills discovery index (`npx skills add https://<origin>`) installs them
 * without cloning the repository.
 *
 * Format: discovery schema 0.2.0 (`/.well-known/agent-skills/index.json`). Each entry is an
 * `archive` — a deterministic `.tar.gz` of the agent skill folder (SKILL.md plus
 * `references/`) — with a `sha256:` digest the installer verifies before it writes a byte.
 * The single source is `renderAgentSkills(REGISTRY)`, the same projection committed under
 * `skills/`; nothing here is hand-maintained, and the hub `README.md` is not an agent skill.
 *
 * Determinism: registry order, mtime 0, uid/gid 0, fixed mode, gzip without a timestamp —
 * the same registry yields the same bytes, so the digest is stable across deployments and
 * an installer's lock (`skills-lock.json`) only changes when the content does.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { renderAgentSkills } from './agent-skills';
import { REGISTRY, type Registry } from './registry';

export const AGENT_SKILLS_DISCOVERY_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
/** Where the index lives; entry URLs are relative to it. */
export const AGENT_SKILLS_DISCOVERY_PATH = '/.well-known/agent-skills';

export interface AgentSkillDiscoveryEntry {
	name: string;
	description: string;
	type: 'archive';
	/** Relative to the index: `<name>.tar.gz`. */
	url: string;
	digest: `sha256:${string}`;
}

export interface AgentSkillDiscovery {
	index: { $schema: string; skills: AgentSkillDiscoveryEntry[] };
	/** Archive bytes by file name (`<name>.tar.gz`). */
	archives: Map<string, Uint8Array>;
}

const TAR_BLOCK = 512;
const encoder = new TextEncoder();

function writeOctal(header: Uint8Array, offset: number, width: number, value: number): void {
	const text = value.toString(8).padStart(width - 1, '0');
	header.set(encoder.encode(text), offset);
	header[offset + width - 1] = 0;
}

/** One ustar header for a regular file. Paths here are short (`references/<id>.md`). */
function tarHeader(path: string, size: number): Uint8Array {
	const name = encoder.encode(path);
	if (name.length > 100) throw new Error(`agent skill archive path too long for ustar: ${path}`);
	const header = new Uint8Array(TAR_BLOCK);
	header.set(name, 0);
	writeOctal(header, 100, 8, 0o644);
	writeOctal(header, 108, 8, 0);
	writeOctal(header, 116, 8, 0);
	writeOctal(header, 124, 12, size);
	writeOctal(header, 136, 12, 0);
	header.fill(0x20, 148, 156); // checksum field counts as spaces while summing
	header[156] = 0x30; // '0' regular file
	header.set(encoder.encode('ustar\u000000'), 257);
	let sum = 0;
	for (const byte of header) sum += byte;
	header.set(encoder.encode(sum.toString(8).padStart(6, '0')), 148);
	header[154] = 0;
	header[155] = 0x20;
	return header;
}

/** A deterministic gzip'd tar of `files` (path → UTF-8 text), in the given order. */
export function tarGzip(files: ReadonlyArray<readonly [string, string]>): Uint8Array {
	const blocks: Uint8Array[] = [];
	for (const [path, text] of files) {
		const body = encoder.encode(text);
		blocks.push(tarHeader(path, body.length), body);
		const pad = (TAR_BLOCK - (body.length % TAR_BLOCK)) % TAR_BLOCK;
		if (pad > 0) blocks.push(new Uint8Array(pad));
	}
	blocks.push(new Uint8Array(TAR_BLOCK * 2));
	const tar = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
	let at = 0;
	for (const block of blocks) {
		tar.set(block, at);
		at += block.length;
	}
	// Node's gzip header carries mtime 0, so equal input gives equal bytes.
	return new Uint8Array(gzipSync(tar, { level: 9 }));
}

function frontmatterField(skillMd: string, field: 'name' | 'description'): string {
	const line = skillMd.split('\n').find((l) => l.startsWith(`${field}: `));
	if (!line) throw new Error(`generated agent skill without ${field}`);
	const raw = line.slice(field.length + 2);
	return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
}

export function buildAgentSkillDiscovery(registry: Registry): AgentSkillDiscovery {
	const bySkill = new Map<string, [string, string][]>();
	for (const [path, content] of renderAgentSkills(registry)) {
		const slash = path.indexOf('/');
		if (slash < 0) continue; // the hub README is not an agent skill
		const skill = path.slice(0, slash);
		const files = bySkill.get(skill) ?? [];
		files.push([path.slice(slash + 1), content]);
		bySkill.set(skill, files);
	}

	const skills: AgentSkillDiscoveryEntry[] = [];
	const archives = new Map<string, Uint8Array>();
	for (const [skill, files] of bySkill) {
		const skillMd = files.find(([p]) => p === 'SKILL.md')?.[1];
		if (!skillMd) throw new Error(`generated agent skill ${skill} has no SKILL.md`);
		const bytes = tarGzip(files);
		const file = `${skill}.tar.gz`;
		archives.set(file, bytes);
		skills.push({
			name: frontmatterField(skillMd, 'name'),
			description: frontmatterField(skillMd, 'description'),
			type: 'archive',
			url: file,
			digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
		});
	}
	return { index: { $schema: AGENT_SKILLS_DISCOVERY_SCHEMA, skills }, archives };
}

let served: AgentSkillDiscovery | undefined;

/** The discovery for the bundled registry, built once per server process (the registry is static). */
export function servedAgentSkillDiscovery(): AgentSkillDiscovery {
	served ??= buildAgentSkillDiscovery(REGISTRY);
	return served;
}
