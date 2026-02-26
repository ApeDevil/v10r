export type PlatformId = 'vercel' | 'container';

export interface PlatformInfo {
	id: PlatformId;
	/** Long-running process (container) vs ephemeral (serverless) */
	persistent: boolean;
}
