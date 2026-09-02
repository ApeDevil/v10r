import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { platform } from '$lib/server/platform';
import { DEFAULT_JOB_INTERVAL_MS, JOB_STARTUP_DELAY_MS } from './config';
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

// Dev is muted by default: the dev container counts as a persistent platform,
// and every job here runs against the ONE production database — including
// analytics-cleanup, which DELETEs rows. JOBS_DEV_ENABLED='true' re-enables
// the loop for deliberately testing job behaviour locally.
if (!building && dev && env.JOBS_DEV_ENABLED !== 'true' && platform.persistent) {
	console.log('[scheduler] Muted in dev (set JOBS_DEV_ENABLED=true to run jobs against the shared DB)');
}

if (!building && platform.persistent && (!dev || env.JOBS_DEV_ENABLED === 'true') && !globalThis.__v10r_scheduler) {
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
