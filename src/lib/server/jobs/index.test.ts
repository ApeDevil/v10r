import { describe, expect, it } from 'vitest';
import { jobs, jobsDueOn } from './index';

const MONDAY = new Date('2026-09-07T03:00:00Z');
const SUNDAY = new Date('2026-09-06T03:00:00Z');

describe('jobsDueOn', () => {
	it('runs the daily jobs every day and the weekly ones only on Sunday (UTC)', () => {
		const weekday = jobsDueOn(MONDAY);
		const sunday = jobsDueOn(SUNDAY);
		expect(weekday.every((slug) => jobs[slug]?.cadence === 'daily')).toBe(true);
		expect(sunday.filter((slug) => jobs[slug]?.cadence === 'weekly').length).toBeGreaterThan(0);
		expect(sunday).toEqual(expect.arrayContaining(weekday));
	});

	it('never includes a standalone job — that one keeps its own cron entry', () => {
		expect(jobs['bot-ranges-refresh']?.standalone).toBe(true);
		expect(jobsDueOn(SUNDAY)).not.toContain('bot-ranges-refresh');
	});

	it('covers every registered job between the Sunday sweep and the standalone entries', () => {
		const standalone = Object.entries(jobs)
			.filter(([, job]) => job.standalone)
			.map(([slug]) => slug);
		expect([...jobsDueOn(SUNDAY), ...standalone].sort()).toEqual(Object.keys(jobs).sort());
	});

	it('keeps registry order, which carries the digest-before-delivery dependency', () => {
		const due = jobsDueOn(MONDAY);
		expect(due.indexOf('bot-hits-flush')).toBe(0);
		expect(due.indexOf('analytics-rollup')).toBeLessThan(due.indexOf('analytics-cleanup'));
		expect(due.indexOf('notification-digest')).toBeLessThan(due.indexOf('notification-delivery'));
		expect(due.indexOf('dbops-refresh')).toBeLessThan(due.indexOf('dbops-reaper'));
	});
});
