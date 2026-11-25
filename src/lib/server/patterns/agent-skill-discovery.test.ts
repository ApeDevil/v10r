import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AGENT_SKILLS_DISCOVERY_SCHEMA, buildAgentSkillDiscovery, tarGzip } from './agent-skill-discovery';
import { renderAgentSkills } from './agent-skills';
import { REGISTRY } from './registry';

/** A minimal ustar reader — enough to prove the archive round-trips exactly. */
function untar(gz: Uint8Array): Map<string, string> {
	const tar = gunzipSync(gz);
	const files = new Map<string, string>();
	let at = 0;
	while (at + 512 <= tar.length) {
		const header = tar.subarray(at, at + 512);
		if (header.every((b) => b === 0)) break;
		const name = new TextDecoder().decode(header.subarray(0, 100)).replace(/\0.*$/s, '');
		const size = Number.parseInt(new TextDecoder().decode(header.subarray(124, 135)), 8);
		let sum = 0;
		for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : header[i];
		expect(Number.parseInt(new TextDecoder().decode(header.subarray(148, 154)), 8)).toBe(sum);
		at += 512;
		files.set(name, new TextDecoder().decode(tar.subarray(at, at + size)));
		at += Math.ceil(size / 512) * 512;
	}
	return files;
}

describe('buildAgentSkillDiscovery', () => {
	const discovery = buildAgentSkillDiscovery(REGISTRY);
	const rendered = renderAgentSkills(REGISTRY);

	it('lists every generated agent skill, and nothing else, under schema 0.2.0', () => {
		expect(discovery.index.$schema).toBe(AGENT_SKILLS_DISCOVERY_SCHEMA);
		const expected = [...rendered.keys()].filter((p) => p.endsWith('/SKILL.md')).map((p) => p.split('/')[0]);
		expect(discovery.index.skills.map((s) => s.name)).toEqual(expected);
		for (const entry of discovery.index.skills) {
			expect(entry.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(entry.description.length).toBeGreaterThan(0);
			expect(entry.description.length).toBeLessThanOrEqual(1024);
			expect(entry).toMatchObject({ type: 'archive', url: `${entry.name}.tar.gz` });
		}
	});

	it('archives each agent skill exactly as committed under skills/, with a matching digest', () => {
		for (const entry of discovery.index.skills) {
			const bytes = discovery.archives.get(entry.url);
			expect(bytes).toBeDefined();
			expect(entry.digest).toBe(
				`sha256:${createHash('sha256')
					.update(bytes as Uint8Array)
					.digest('hex')}`,
			);
			const files = untar(bytes as Uint8Array);
			expect(files.get('SKILL.md')).toBe(rendered.get(`${entry.name}/SKILL.md`));
			const committed = [...rendered.keys()].filter((p) => p.startsWith(`${entry.name}/`));
			expect([...files.keys()].map((p) => `${entry.name}/${p}`)).toEqual(committed);
		}
	});

	it('is byte-deterministic, so digests and installer locks only move with the content', () => {
		const again = buildAgentSkillDiscovery(REGISTRY);
		expect(again.index).toEqual(discovery.index);
		expect(tarGzip([['a.md', 'x']])).toEqual(tarGzip([['a.md', 'x']]));
	});

	it('never ships the hub README as an agent skill', () => {
		expect([...discovery.archives.keys()].some((k) => k.startsWith('README'))).toBe(false);
	});
});
