import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { DEFAULT_JOB_INTERVAL_MS, JOB_STARTUP_DELAY_MS } from '$lib/server/config';
import { platform } from '$lib/server/platform';
import { jobs } from './index';
import { runJob } from './runner';

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
	const interval = Number(env.JOB_INTERVAL_MS) || DEFAULT_JOB_INTERVAL_MS;

	console.log(`[scheduler] Starting on ${platform.id} platform, interval: ${interval / 1000}s`);

	setTimeout(runAll, JOB_STARTUP_DELAY_MS);

	const timer = setInterval(runAll, interval);
	timer.unref();
	globalThis.__v10r_scheduler = timer;

	process.on('SIGTERM', () => {
		console.log('[scheduler] SIGTERM received, clearing interval');
		clearInterval(timer);
		globalThis.__v10r_scheduler = undefined;
	});
}
