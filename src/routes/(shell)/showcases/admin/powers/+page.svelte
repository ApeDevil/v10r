<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';

interface Group {
	label: string;
	tone: 'observe' | 'manage' | 'content' | 'system';
	icon: string;
	items: { label: string; href: string; icon: string; can: string }[];
}

const groups: Group[] = [
	{
		label: 'Observe',
		tone: 'observe',
		icon: 'i-lucide-eye',
		items: [
			{
				label: 'DB Observation',
				href: '/admin/db',
				icon: 'i-lucide-database',
				can: 'Read row counts and live queries — no writes.',
			},
			{
				label: 'Analytics',
				href: '/admin/analytics',
				icon: 'i-lucide-bar-chart-2',
				can: 'Aggregate dashboards over the retention window. No raw IPs.',
			},
			{
				label: 'Audit Log',
				href: '/admin/audit',
				icon: 'i-lucide-shield-check',
				can: 'Read every admin write that has ever happened. Append-only.',
			},
			{
				label: 'Feedback',
				href: '/admin/feedback',
				icon: 'i-lucide-message-square',
				can: 'Read submissions and update their status (new / read / archived).',
			},
		],
	},
	{
		label: 'Manage',
		tone: 'manage',
		icon: 'i-lucide-sliders',
		items: [
			{
				label: 'Users',
				href: '/admin/users',
				icon: 'i-lucide-users',
				can: 'View and ban accounts. Cannot read passwords (Argon2 hashed).',
			},
			{
				label: 'Feature Flags',
				href: '/admin/flags',
				icon: 'i-lucide-toggle-right',
				can: 'Toggle features for rollout / kill-switch.',
			},
			{
				label: 'Branding',
				href: '/admin/branding',
				icon: 'i-lucide-palette',
				can: 'Update site name and theme tokens.',
			},
		],
	},
	{
		label: 'Content',
		tone: 'content',
		icon: 'i-lucide-file-text',
		items: [
			{
				label: 'Posts',
				href: '/admin/content/posts',
				icon: 'i-lucide-file-text',
				can: 'Create, edit, and publish posts.',
			},
			{ label: 'Tags', href: '/admin/content/tags', icon: 'i-lucide-tag', can: 'Manage taxonomy.' },
		],
	},
	{
		label: 'System',
		tone: 'system',
		icon: 'i-lucide-cog',
		items: [
			{
				label: 'Jobs',
				href: '/admin/jobs',
				icon: 'i-lucide-clock',
				can: 'Inspect cron history; manually re-run a job.',
			},
			{
				label: 'Notifications',
				href: '/admin/notifications',
				icon: 'i-lucide-bell',
				can: 'Configure email / Telegram / Discord channels.',
			},
			{ label: 'AI Usage', href: '/admin/ai', icon: 'i-lucide-bot', can: 'Read token usage and per-model spend.' },
			{ label: 'RAG', href: '/admin/rag', icon: 'i-lucide-book-open', can: 'Inspect retrieval index health.' },
			{
				label: 'Cache',
				href: '/admin/cache',
				icon: 'i-lucide-hard-drive',
				can: 'Inspect Redis state; flush stale keys.',
			},
		],
	},
];

const guarantees = [
	{
		icon: 'i-lucide-key',
		title: 'Single-admin gate',
		body: 'The admin surface is gated by a single environment variable, ADMIN_EMAIL. There is no is_admin database column and no role table — nothing to escalate, nothing to drift.',
	},
	{
		icon: 'i-lucide-eye-off',
		title: '404, not 403',
		body: 'Non-admins receive a generic 404 from any /admin/* path. The gate does not leak the existence of admin routes to unauthenticated visitors.',
	},
	{
		icon: 'i-lucide-history',
		title: 'Append-only audit',
		body: 'Every admin write is logged to audit_log with actor, action, target, and timestamp. The audit table has no UPDATE or DELETE handlers — entries cannot be erased after the fact.',
	},
	{
		icon: 'i-lucide-lock',
		title: 'No write without consent',
		body: 'Cron jobs that mutate user-facing data (cleanup, rollup) are gated behind a Bearer token shared only with Vercel Cron, not exposed in any UI.',
	},
];
</script>

<svelte:head>
	<title>Admin powers — Admin & Privacy</title>
</svelte:head>

<div class="powers">
	<header class="lede">
		<h2>What the operator can see — and what stops them from doing more.</h2>
		<p>
			Transparency cuts both ways. You should know not just what is collected, but what the person
			running v10r.dev can do with it. Below is the full inventory of admin capabilities, along with the
			four guarantees that hem them in.
		</p>
	</header>

	<section class="guarantees">
		<header class="section-head">
			<h3>Four hard guarantees</h3>
			<Tag variant="muted" size="sm" label="Code-enforced" />
		</header>
		<div class="guarantee-grid">
			{#each guarantees as g}
				<article class="guarantee-card">
					<span class="guarantee-icon {g.icon}" aria-hidden="true"></span>
					<div>
						<h4>{g.title}</h4>
						<p>{g.body}</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="capabilities">
		<header class="section-head">
			<h3>What the admin sidebar exposes</h3>
			<Tag variant="muted" size="sm" label="admin-only — non-admins 404" />
		</header>

		<div class="group-list">
			{#each groups as group}
				<article class="group-card group-{group.tone}">
					<header class="group-head">
						<span class="group-icon {group.icon}" aria-hidden="true"></span>
						<h4>{group.label}</h4>
					</header>
					<ul class="item-list">
						{#each group.items as item}
							<li>
								<span class="item-icon {item.icon}" aria-hidden="true"></span>
								<div class="item-body">
									<a href={item.href} class="item-link">{item.label}</a>
									<span class="item-detail">{item.can}</span>
								</div>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="threat-model">
		<header class="section-head">
			<h3>What the admin can <em>not</em> do</h3>
		</header>
		<ul class="cant-list">
			<li><span class="i-lucide-x-circle text-icon-sm" aria-hidden="true"></span> Read your raw IP. We never wrote it down.</li>
			<li><span class="i-lucide-x-circle text-icon-sm" aria-hidden="true"></span> Read your password. Argon2id is one-way; no offline crack worth attempting.</li>
			<li><span class="i-lucide-x-circle text-icon-sm" aria-hidden="true"></span> See your journey if you rejected analytics. There is no <code>session_id</code> to join on.</li>
			<li><span class="i-lucide-x-circle text-icon-sm" aria-hidden="true"></span> Erase the audit log. No UPDATE / DELETE handlers exist for that table.</li>
			<li><span class="i-lucide-x-circle text-icon-sm" aria-hidden="true"></span> Promote anyone to admin via a database write. The gate is an env var; promotion requires Vercel access + a redeploy.</li>
		</ul>
	</section>

	<aside class="cross-link">
		<span class="i-lucide-arrow-right" aria-hidden="true"></span>
		<p>
			See the audit pattern in code: <code>recordAuditEvent</code> in
			<code>src/lib/server/admin/audit.ts</code>, called from every admin form action.
		</p>
	</aside>
</div>

<style>
	.powers {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.lede h2 {
		margin: 0 0 var(--spacing-2) 0;
		font-size: var(--text-fluid-xl);
		font-weight: 600;
		color: var(--color-fg);
	}

	.lede p {
		margin: 0;
		max-width: 65ch;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-4);
	}

	.section-head h3 {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.section-head em {
		color: var(--color-error);
		font-style: normal;
		font-weight: 700;
	}

	.guarantee-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.guarantee-grid {
			grid-template-columns: 1fr;
		}
	}

	.guarantee-card {
		display: flex;
		gap: var(--spacing-3);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.guarantee-icon {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-success);
	}

	.guarantee-card h4 {
		margin: 0 0 var(--spacing-1) 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.guarantee-card p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.group-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.group-list {
			grid-template-columns: 1fr;
		}
	}

	.group-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding-bottom: var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
	}

	.group-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
	}

	.group-head h4 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item-list li {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
	}

	.item-icon {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		margin-top: 0.2rem;
		color: var(--color-muted);
	}

	.item-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		flex: 1;
		min-width: 0;
	}

	.item-link {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		text-decoration: none;
	}

	.item-link::after {
		content: ' (admin-only)';
		font-weight: 400;
		font-size: 0.85em;
		color: var(--color-muted);
	}

	.item-link:hover {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.item-detail {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.cant-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin: 0;
		padding: var(--spacing-5);
		list-style: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.cant-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.cant-list li span {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--color-error);
	}

	.cant-list code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.cross-link {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.cross-link span {
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.15rem;
		color: var(--color-primary);
	}

	.cross-link p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.6;
	}

	.cross-link code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		border: 1px solid var(--color-border);
	}
</style>
