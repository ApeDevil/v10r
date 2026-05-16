<script lang="ts">
import { page } from '$app/state';
import { ErrorDisplay } from '$lib/components/composites';

const HINT_MAP: [string, string][] = [
	['/showcases/db/relational', 'Check your Neon DATABASE_URL in .env — is the connection string valid?'],
	['/showcases/db/graph', 'Check NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD in .env.'],
	['/showcases/db/storage', 'Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env.'],
	['/showcases/3d', 'WebGL is required. Check that your browser supports it and graphics drivers are up to date.'],
	['/showcases/ai', 'Check your AI provider API key in .env.'],
];

const DEFAULT_HINT = 'This showcase may require environment variables. Check .env and the relevant docs.';

const path = $derived(page.url.pathname);
const hint = $derived(HINT_MAP.find(([prefix]) => path.startsWith(prefix))?.[1] ?? DEFAULT_HINT);
</script>

<svelte:head>
	<title>{page.status} — Error</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
	context="showcase"
>
	<div class="hint">
		<span class="i-lucide-lightbulb hint-icon" aria-hidden="true"></span>
		<p class="hint-text">{hint}</p>
	</div>
</ErrorDisplay>

<style>
	.hint {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
		text-align: left;
	}

	.hint-icon {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		margin-top: 0.125rem;
		color: var(--color-primary);
	}

	.hint-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.5;
	}
</style>
