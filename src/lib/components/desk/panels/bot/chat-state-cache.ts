import type { UIMessage } from 'ai';

/**
 * Module-level cache that preserves chat state when panels are destroyed
 * and recreated (e.g., dragging a panel to a different dock position).
 */
export const chatStateCache = new Map<string, { conversationId?: string; messages: UIMessage[] }>();
