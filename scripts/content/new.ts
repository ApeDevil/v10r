#!/usr/bin/env bun
/**
 * Scaffold a new content/<domain>/<slug>/en.md with a fresh UUID v7 baked into
 * frontmatter. Refuses to overwrite an existing file.
 *
 * Usage:
 *   bun run content:new <slug> [--domain=blog] [--title="..."] [--summary="..."]
 *
 * Default domain is `blog`. The UUID v7 in `id` is stable across slug renames —
 * never edit it by hand. After scaffolding, edit the body, then run:
 *   bun run content:check
 *   bun run content:push <slug>
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { serializeContentFile } from '$lib/server/content/frontmatter';

interface Args {
	slug: string;
	domain: string;
	title?: string;
	summary?: string;
}

function parseArgs(argv: string[]): Args {
	const positional: string[] = [];
	const flags = new Map<string, string>();
	for (const arg of argv) {
		if (arg.startsWith('--')) {
			const eq = arg.indexOf('=');
			if (eq > 0) flags.set(arg.slice(2, eq), arg.slice(eq + 1));
			else flags.set(arg.slice(2), '');
		} else {
			positional.push(arg);
		}
	}
	const slug = positional[0];
	if (!slug) {
		console.error('usage: bun run content:new <slug> [--domain=blog] [--title="..."] [--summary="..."]');
		process.exit(1);
	}
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
		console.error(`invalid slug: ${slug} (must be lowercase kebab-case)`);
		process.exit(1);
	}
	return {
		slug,
		domain: flags.get('domain') ?? 'blog',
		title: flags.get('title'),
		summary: flags.get('summary'),
	};
}

const args = parseArgs(process.argv.slice(2));
const dir = join(process.cwd(), 'content', args.domain, args.slug);
const enPath = join(dir, 'en.md');

try {
	await stat(enPath);
	console.error(`refusing to overwrite ${enPath}`);
	process.exit(1);
} catch (err: unknown) {
	if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

await mkdir(dir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const frontmatter = {
	id: uuidv7(),
	slug: args.slug,
	title: args.title ?? '',
	summary: args.summary ?? '',
	tags: [],
	status: 'draft',
	date: today,
};

const body = `\nWrite the post here. Translate to other locales by asking Claude Code:\n\n> translate content/${args.domain}/${args.slug}/en.md to de and ru\n`;

await writeFile(enPath, serializeContentFile(frontmatter, body), 'utf8');

console.log(`[content:new] scaffolded ${enPath}`);
console.log(`              id: ${frontmatter.id}`);
console.log(`              edit the title/summary/body, then run:`);
console.log(`                  bun run content:check`);
console.log(`                  bun run content:push ${args.slug}`);
