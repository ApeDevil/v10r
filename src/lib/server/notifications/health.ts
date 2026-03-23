/**
 * Live channel health probes — pings external APIs to verify connectivity.
 * Used by the admin notifications page for real-time health status.
 */

import { env } from '$env/dynamic/private';

export interface ProbeResult {
	status: 'ok' | 'error' | 'unconfigured';
	latencyMs: number;
	message?: string;
}

export interface ChannelProbes {
	discord: ProbeResult | null;
	telegram: ProbeResult | null;
}

async function probeWithTimeout(
	fn: () => Promise<ProbeResult>,
	timeoutMs = 5000,
): Promise<ProbeResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fn();
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			return { status: 'error', latencyMs: timeoutMs, message: 'Timeout' };
		}
		return {
			status: 'error',
			latencyMs: 0,
			message: err instanceof Error ? err.message : 'Unknown error',
		};
	} finally {
		clearTimeout(timer);
	}
}

async function probeDiscord(): Promise<ProbeResult> {
	const token = env.DISCORD_BOT_TOKEN;
	if (!token) {
		return { status: 'unconfigured', latencyMs: 0, message: 'DISCORD_BOT_TOKEN not set' };
	}

	const start = performance.now();
	const res = await fetch('https://discord.com/api/v10/users/@me', {
		headers: { Authorization: `Bot ${token}` },
	});
	const latencyMs = Math.round(performance.now() - start);

	if (res.ok) {
		return { status: 'ok', latencyMs };
	}

	return {
		status: 'error',
		latencyMs,
		message: `HTTP ${res.status}: ${res.statusText}`,
	};
}

async function probeTelegram(): Promise<ProbeResult> {
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) {
		return { status: 'unconfigured', latencyMs: 0, message: 'TELEGRAM_BOT_TOKEN not set' };
	}

	const start = performance.now();
	const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
	const latencyMs = Math.round(performance.now() - start);

	if (res.ok) {
		const data = await res.json();
		if (data.ok) {
			return { status: 'ok', latencyMs };
		}
	}

	return {
		status: 'error',
		latencyMs,
		message: `HTTP ${res.status}: ${res.statusText}`,
	};
}

export async function probeChannels(): Promise<ChannelProbes> {
	const [discord, telegram] = await Promise.allSettled([
		probeWithTimeout(probeDiscord),
		probeWithTimeout(probeTelegram),
	]);

	return {
		discord: discord.status === 'fulfilled' ? discord.value : { status: 'error', latencyMs: 0, message: 'Probe failed' },
		telegram: telegram.status === 'fulfilled' ? telegram.value : { status: 'error', latencyMs: 0, message: 'Probe failed' },
	};
}
