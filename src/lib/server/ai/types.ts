export interface AIConnectionInfo {
	connected: boolean;
	provider: string;
	model: string;
	latencyMs: number | null;
	error: string | null;
}

export interface AIProviderStatus {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	envVar: string;
}
