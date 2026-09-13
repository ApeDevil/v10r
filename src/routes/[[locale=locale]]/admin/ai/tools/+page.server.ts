import { PROFILES } from '$lib/server/ai/profile';
import { profileCapabilities } from '$lib/server/ai/profile/manifest';
import { chatbotToolMeta, type DeskToolMeta, deskbotToolMeta } from '$lib/server/ai/tools';
import { requireAdmin } from '$lib/server/http/guards';
import type { PageServerLoad } from './$types';

/**
 * Tool topology — derived at load time from the two profiles the orchestrator composes
 * turns from (single source of truth; the table can't drift from the real tool set): each
 * capability's tools with the description the model receives, the risk/scope meta from the
 * manifest, the step budget from the profile. BRANCH is the profile's surface.
 */

const RISK_ORDER: Record<string, number> = { read: 0, create: 1, write: 2, destructive: 3 };

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const viewer = { userId: locals.user?.id ?? '', locale: locals.locale ?? 'en', authCeiling: 'admin' as const };
	const [chatbot, deskbot] = await Promise.all([
		profileCapabilities(PROFILES.chatbot, viewer),
		profileCapabilities(PROFILES.deskbot, viewer),
	]);

	const tools = [
		...chatbot.capabilities.flatMap((c) =>
			c.tools.map((t) => ({ tool: t, capability: c, branch: 'retrieval' as const })),
		),
		...deskbot.capabilities.flatMap((c) => c.tools.map((t) => ({ tool: t, capability: c, branch: 'desk' as const }))),
	]
		.filter(({ tool }) => tool.name in chatbotToolMeta || tool.name in deskbotToolMeta)
		.map(({ tool, capability, branch }) => {
			const meta = branch === 'retrieval' ? chatbotToolMeta[tool.name] : deskbotToolMeta[tool.name];
			const scope = (meta as Partial<DeskToolMeta>).scope;
			const mutating = branch === 'desk' && scope !== 'desk:read';
			return {
				name: tool.name,
				branch,
				capability: capability.id,
				risk: meta.risk,
				scope: scope ?? null,
				scopeLabel: branch === 'retrieval' ? 'always-on' : (scope ?? ''),
				stepBudget: branch === 'retrieval' ? 3 : mutating ? 5 : 3,
				note: tool.description,
			};
		});

	tools.sort((a, b) => {
		if (a.branch !== b.branch) return a.branch === 'retrieval' ? -1 : 1;
		return (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9) || a.name.localeCompare(b.name);
	});

	return { title: 'Tools', tools };
};
