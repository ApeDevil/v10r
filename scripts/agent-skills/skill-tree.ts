/**
 * Read a directory of agent skills off disk into the shape the validator takes:
 * path relative to `root` (forward slashes) → UTF-8 content. Missing root → empty map.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readSkillTree(root: string): Map<string, string> {
	const tree = new Map<string, string>();
	if (!existsSync(root)) return tree;
	const walk = (dir: string, prefix: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			if (entry.isDirectory()) walk(join(dir, entry.name), rel);
			else if (entry.isFile()) tree.set(rel, readFileSync(join(dir, entry.name), 'utf8'));
		}
	};
	walk(root, '');
	return tree;
}
