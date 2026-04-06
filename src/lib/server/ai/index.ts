import { buildProviderRegistry, getFallbackProviders, resolveActiveProvider, resolveToolProvider } from './providers';

const registry = buildProviderRegistry();
const active = resolveActiveProvider(registry);
const toolProvider = resolveToolProvider(registry);

/** Whether any AI provider is configured */
export const aiConfigured = active !== null;

/** Active chat model — null when no provider is available */
export const chatModel = active?.getInstance() ?? null;

/** Tool-capable model — may differ from chatModel. Null if no tool-capable provider. */
export const toolModel = toolProvider?.getInstance() ?? null;

/** Info about the active provider */
export const activeProviderInfo = active ? { id: active.id, name: active.name, model: active.model } : null;

/** Full provider registry for status pages */
export const providerRegistry = registry;

/** Fallback providers (configured, excluding active) */
export const fallbackProviders = active ? getFallbackProviders(registry, active.id) : [];
