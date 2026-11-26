/**
 * The ship script's approval guards (`--expect-sha`, `--feedback`), in disposable git repos.
 *
 * Each test builds a bare "GitHub" repo and a working clone whose `origin` URL is the real
 * one, rewritten to the bare repo with `url.insteadOf` — the script reads the configured URL
 * for its authority check, so it believes it talks to ApeDevil/v10r while git talks to the
 * sandbox. Every run targets a `probe` branch with `--no-gate` (the only way the script
 * allows skipping the gate), so nothing here can reach main, the network or the real repo.
 *
 * Races are injected with a `git` shim on PATH that moves the target branch in the bare repo
 * right before the script's own step-6 fetch or its push.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/ship/squash-into-main.sh');
const AUTHORITY = 'https://github.com/ApeDevil/v10r.git';
const FEEDBACK = 'fbk_0123456789ab';

const GIT_ENV = {
	GIT_AUTHOR_NAME: 'Probe',
	GIT_AUTHOR_EMAIL: 'probe@example.invalid',
	GIT_COMMITTER_NAME: 'Probe',
	GIT_COMMITTER_EMAIL: 'probe@example.invalid',
	GIT_CONFIG_GLOBAL: '/dev/null',
	GIT_CONFIG_NOSYSTEM: '1',
};

let root: string;
let bare: string;
let work: string;
let other: string;

function git(cwd: string, ...args: string[]): string {
	const r = spawnSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
	return r.stdout.trim();
}

function commit(cwd: string, file: string, content: string): string {
	writeFileSync(join(cwd, file), content);
	git(cwd, 'add', file);
	git(cwd, 'commit', '-qm', `change ${file}`);
	return git(cwd, 'rev-parse', 'HEAD');
}

function clone(dir: string) {
	git(root, 'clone', '-q', bare, dir);
	git(dir, 'remote', 'set-url', 'origin', AUTHORITY);
	git(dir, 'config', `url.${bare}.insteadOf`, AUTHORITY);
}

interface Run {
	status: number | null;
	out: string;
}

function ship(args: string[], env: Record<string, string> = {}): Run {
	const r = spawnSync('bash', [SCRIPT, 'feature', '--onto', 'probe', '--no-gate', ...args], {
		cwd: work,
		env: { ...process.env, ...GIT_ENV, CLAUDE_CODE_REMOTE: 'true', ...env },
		encoding: 'utf8',
	});
	return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

/** A `git` on PATH that moves `probe` in the bare repo before the matching call runs. */
function raceShim(trigger: 'fetch' | 'push' | 'branch'): Record<string, string> {
	const bin = join(root, 'bin');
	rmSync(bin, { recursive: true, force: true });
	spawnSync('mkdir', ['-p', bin]);
	const realGit = spawnSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
	const match =
		trigger === 'push' ? '[ "$1" = "push" ] && [ "$2" = "origin" ]' : '[ "$*" = "fetch --quiet origin probe" ]';
	// 'branch' moves the approved feature branch instead of the target, right after the gate.
	const ref = trigger === 'branch' ? 'feature' : 'probe';
	writeFileSync(
		join(bin, 'git'),
		[
			'#!/usr/bin/env bash',
			`if ${match} && [ ! -e "${root}/raced" ]; then`,
			`  touch "${root}/raced"`,
			`  (cd "${other}" && "${realGit}" fetch -q origin ${ref} && "${realGit}" checkout -q -B ${ref} FETCH_HEAD \\`,
			`    && echo race > race.txt && "${realGit}" add race.txt && "${realGit}" commit -qm race \\`,
			`    && "${realGit}" push -q origin ${ref}) >/dev/null 2>&1`,
			'fi',
			`exec "${realGit}" "$@"`,
			'',
		].join('\n'),
	);
	chmodSync(join(bin, 'git'), 0o755);
	return { PATH: `${bin}:${process.env.PATH}` };
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'ship-guard-'));
	bare = join(root, 'github.git');
	work = join(root, 'work');
	other = join(root, 'other');
	git(root, 'init', '-q', '--bare', '-b', 'main', bare);

	// main and probe start at the same commit; feature branches off it and is pushed.
	git(root, 'init', '-q', '-b', 'main', work);
	commit(work, 'README', 'base\n');
	git(work, 'remote', 'add', 'origin', AUTHORITY);
	git(work, 'config', `url.${bare}.insteadOf`, AUTHORITY);
	git(work, 'push', '-q', 'origin', 'main', 'main:probe');
	git(work, 'checkout', '-qb', 'feature');
	commit(work, 'feature.txt', 'the reviewed change\n');
	git(work, 'push', '-q', '-u', 'origin', 'feature');
	clone(other);
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

const head = () => git(work, 'rev-parse', 'HEAD');
const remoteRef = (ref: string) => git(work, 'ls-remote', 'origin', `refs/heads/${ref}`).split('\t')[0];

describe('squash-into-main.sh --expect-sha', () => {
	it('ships exactly the approved tree and prints a receipt bound to it', () => {
		const approved = head();
		const run = ship(['--expect-sha', approved, '--feedback', FEEDBACK]);
		expect(run.status, run.out).toBe(0);
		const shipped = remoteRef('probe');
		expect(git(work, 'rev-parse', `${shipped}^{tree}`)).toBe(git(work, 'rev-parse', `${approved}^{tree}`));
		const receipt = JSON.parse(/```v10r-shipping-receipt\/1\n([\s\S]*?)\n```/.exec(run.out)?.[1] ?? 'null');
		expect(receipt).toMatchObject({
			format: 'v10r-shipping-receipt/1',
			feedbackId: FEEDBACK,
			branch: 'feature',
			approvedSha: approved,
			shipCommit: shipped,
			gitlabSync: 'pending',
			deployment: { state: 'pending' },
		});
		// --no-gate never reports a passed gate.
		expect(receipt.gate).toEqual({ validate: 'failed', validateBuild: 'failed' });
	});

	it('refuses when the local HEAD is not the approved SHA', () => {
		const approved = head();
		commit(work, 'feature.txt', 'changed after review\n');
		git(work, 'push', '-q', 'origin', 'feature');
		const run = ship(['--expect-sha', approved]);
		expect(run.status).toBe(1);
		expect(run.out).toMatch(/Local HEAD is .* renewed release approval/s);
		expect(remoteRef('probe')).toBe(git(work, 'rev-parse', 'main'));
	});

	it('refuses when the branch moved on the server after review, even if the local copy matches', () => {
		const approved = head();
		git(other, 'fetch', '-q', 'origin', 'feature');
		git(other, 'checkout', '-qb', 'feature', 'FETCH_HEAD');
		commit(other, 'feature.txt', 'pushed by someone else\n');
		git(other, 'push', '-q', 'origin', 'feature');
		const run = ship(['--expect-sha', approved]);
		expect(run.status).toBe(1);
		expect(run.out).toMatch(/on the server, the approval names/);
		expect(remoteRef('probe')).toBe(git(work, 'rev-parse', 'main'));
	});

	it('refuses to merge in a target that moved after review', () => {
		const approved = head();
		git(other, 'checkout', '-qb', 'probe', 'origin/probe');
		commit(other, 'other.txt', 'landed on the target meanwhile\n');
		git(other, 'push', '-q', 'origin', 'probe');
		const before = remoteRef('probe');
		const run = ship(['--expect-sha', approved]);
		expect(run.status).toBe(1);
		expect(run.out).toMatch(/moved .* after the review/);
		expect(remoteRef('probe')).toBe(before);
		expect(head()).toBe(approved);
	});

	it('stops with exit 3 when the target moves while the ship runs (before the push)', () => {
		const run = ship(['--expect-sha', head()], raceShim('fetch'));
		expect(run.status, run.out).toBe(3);
		expect(run.out).toMatch(/renewed release approval/);
		expect(git(work, 'log', '-1', '--format=%s', remoteRef('probe'))).toBe('race');
	});

	it('refuses when the approved branch moves while the ship runs (re-checked right before the push)', () => {
		const before = remoteRef('probe');
		const run = ship(['--expect-sha', head()], raceShim('branch'));
		expect(run.status, run.out).toBe(1);
		expect(run.out).toMatch(/moved to .* while the ship ran.*renewed release approval/s);
		expect(remoteRef('probe')).toBe(before);
	});

	it('the plain push loses a race cleanly: exit 3, nothing forced', () => {
		const run = ship(['--expect-sha', head()], raceShim('push'));
		expect(run.status, run.out).toBe(3);
		git(work, 'fetch', '-q', 'origin', 'probe');
		expect(git(work, 'log', '-1', '--format=%s', remoteRef('probe'))).toBe('race');
	});

	it('validates its arguments', () => {
		expect(ship(['--expect-sha', 'abc123']).out).toMatch(/full 40-character/);
		expect(ship(['--feedback', FEEDBACK]).out).toMatch(/--feedback needs --expect-sha/);
		expect(ship(['--expect-sha', head(), '--feedback', 'not-an-id']).out).toMatch(/feedback id/);
		for (const args of [
			['--expect-sha', 'abc123'],
			['--feedback', FEEDBACK],
		])
			expect(ship(args).status).toBe(1);
		expect(remoteRef('probe')).toBe(git(work, 'rev-parse', 'main'));
	});

	it('refuses a remote that is not the authority, whatever it points at', () => {
		git(work, 'remote', 'set-url', 'origin', bare);
		const run = ship(['--expect-sha', head()]);
		expect(run.status).toBe(1);
		expect(run.out).toMatch(/ApeDevil\/v10r only/);
	});
});
