import { sessionCleanup } from './session-cleanup';

export interface Job {
	execute: () => Promise<number>;
}

export const jobs: Record<string, Job> = {
	'session-cleanup': { execute: sessionCleanup },
};
