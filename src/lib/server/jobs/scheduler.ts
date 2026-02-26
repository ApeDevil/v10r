import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { platform } from '$lib/server/platform';
import { jobs } from './index';
import { runJob } from './runner';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 5_000;

declare global {
	var __v10r_scheduler: ReturnType<typeof setInterval> | undefined;
}

function runAll() {
	for (const slug of Object.keys(jobs)) {
		runJob(slug, 'scheduler')
			.then((r) => console.log(`[scheduler] ${slug}: ${r.status} (${r.durationMs}ms)`))
			.catch((err) => console.error(`[scheduler] ${slug} unexpected:`, err));
	}
}

if (!building && platform.persistent && !globalThis.__v10r_scheduler) {
	const interval = Number(env.JOB_INTERVAL_MS) || THREE_HOURS_MS;

	console.log(`[scheduler] Starting on ${platform.id} platform, interval: ${interval / 1000}s`);

	setTimeout(runAll, STARTUP_DELAY_MS);

	const timer = setInterval(runAll, interval);
	timer.unref();
	globalThis.__v10r_scheduler = timer;

	process.once('SIGTERM', () => {
		console.log('[scheduler] SIGTERM received, clearing interval');
		clearInterval(timer);
		globalThis.__v10r_scheduler = undefined;
	});
}
