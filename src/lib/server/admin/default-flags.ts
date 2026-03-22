export const DEFAULT_FLAGS = [
	{ key: 'maintenance_mode', value: false, description: 'Show maintenance page to non-admin users' },
	{ key: 'feature.ai_chat', value: true, description: 'Enable AI chat for all users' },
	{ key: 'feature.rag_upload', value: true, description: 'Enable RAG document uploads' },
] as const;
