<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';
import * as m from '$lib/paraglide/messages';

interface DataRow {
	field: string;
	type: string;
	example?: string;
	note?: string;
}

interface DataCategory {
	id: string;
	icon: string;
	title: string;
	when: string;
	basis: { article: string; label: string };
	rows: DataRow[];
	notes?: string[];
}

const categories: DataCategory[] = [
	{
		id: 'pre-consent',
		icon: 'i-lucide-globe',
		title: 'Pre-consent visit (default)',
		when: 'Every public page request, before you click anything on the cookie banner.',
		basis: { article: 'Art. 6(1)(f)', label: 'Legitimate interest' },
		rows: [
			{
				field: 'visitor_id',
				type: 'sha256(ip + user-agent)',
				example: 'v_a3f29c81d6e4b5f0',
				note: 'Hashed at request time. Raw IP is never written to the database.',
			},
			{ field: 'path', type: 'string', example: '/showcases', note: 'Pathname only. Query strings are dropped.' },
			{ field: 'timestamp', type: 'timestamptz', example: '2026-05-01 14:21:08+00' },
			{
				field: 'country',
				type: 'iso-2 (coarse)',
				example: 'DE',
				note: 'From CDN edge headers; never the city or region.',
			},
			{
				field: 'referrer',
				type: 'origin only',
				example: 'https://google.com',
				note: 'Stripped to scheme + host. No path, no query.',
			},
		],
		notes: [
			'Pre-consent traffic exists so the site can count visits and detect abuse — that is the legitimate interest.',
			'Device, browser, and full referrer fields are NULL until you give analytics consent.',
			'Bot and prefetch requests are filtered out before any row is written.',
		],
	},
	{
		id: 'consented',
		icon: 'i-lucide-check-circle',
		title: 'After "Accept all" or "Customize → Analytics"',
		when: 'Only after you actively grant analytics consent via the cookie banner.',
		basis: { article: 'Art. 6(1)(a)', label: 'Consent' },
		rows: [
			{ field: 'all of the above', type: '—', note: 'Pre-consent fields continue to apply.' },
			{ field: 'device', type: 'enum', example: 'desktop / mobile / tablet' },
			{ field: 'browser', type: 'string', example: 'Chrome 130' },
			{
				field: 'referrer (full)',
				type: 'string',
				example: 'https://news.ycombinator.com/item?id=...',
				note: 'The full URL replaces the origin-only version.',
			},
			{
				field: 'session_id',
				type: 'cookie _v10r_sid',
				example: 's_b9a72c0f',
				note: 'Lets us reconstruct the page-by-page journey.',
			},
			{
				field: 'journey events',
				type: 'page transitions',
				note: 'Sent via sendBeacon on tab close. Deduplicated by event_id.',
			},
		],
		notes: [
			'Consent is recorded with timestamp, IP-hash, and the exact tier — kept for 13 months as Art. 7(1) demonstrability.',
			'You can withdraw consent at any time through the banner; the SID cookie is cleared and journey collection stops on the next request.',
		],
	},
	{
		id: 'feedback',
		icon: 'i-lucide-message-square',
		title: 'Feedback you submit',
		when: 'Only when you fill in and submit the /feedback form.',
		basis: { article: 'Art. 6(1)(f)', label: 'Legitimate interest (responding)' },
		rows: [
			{ field: 'subject', type: 'string (3–120)', example: 'Bug on the chat page' },
			{ field: 'body', type: 'string (10–4000)', example: '…' },
			{ field: 'rating', type: 'smallint 1–5 (optional)' },
			{ field: 'contact_email', type: 'email (optional)', note: 'Only if you provide one for follow-up.' },
			{ field: 'page_of_origin', type: 'string', example: '/showcases/ai/chat' },
			{
				field: 'session_id',
				type: 'string (nullable)',
				note: 'Set only if you had analytics consent at submit time. Lets the operator see which pages you visited before the message.',
			},
		],
		notes: [
			'Honeypot + minimum-fill-time + rate limit reject obvious bots before storage.',
			'Feedback is kept until you ask to have it removed — there is no automatic expiry. Email the controller to delete a specific submission.',
		],
	},
	{
		id: 'auth',
		icon: 'i-lucide-key',
		title: 'Account data (if you sign in)',
		when: 'Only if you create or use an account on the protected /app surface.',
		basis: { article: 'Art. 6(1)(b)', label: 'Performance of contract' },
		rows: [
			{ field: 'email', type: 'string', note: 'Used to identify you and reach you for account events.' },
			{ field: 'password', type: 'argon2 hash', note: 'Plaintext is never written to disk.' },
			{ field: 'session_token', type: 'opaque, http-only cookie', note: 'Better Auth manages rotation and expiry.' },
			{
				field: 'audit trail',
				type: 'login / logout / password change',
				note: 'Stored to support security investigations under Art. 32.',
			},
		],
		notes: ['Account creation is optional — you can use the public site without ever signing in.'],
	},
];
</script>
<div class="data-page">
	<header class="lede">
		<h2>{m.showcase_admin_data_heading()}</h2>
		<p>
			Four categories. The first applies to every visitor; the others only kick in when you explicitly opt in,
			send feedback, or sign in. Every field below is sourced from the actual database schema in
			<code>src/lib/server/db/schema/</code>.
		</p>
	</header>

	<nav class="anchor-nav" aria-label="Data categories">
		{#each categories as cat}
			<a href="#{cat.id}" class="anchor-link">
				<span class="anchor-icon {cat.icon}" aria-hidden="true"></span>
				{cat.title.split(' ').slice(0, 3).join(' ')}
			</a>
		{/each}
	</nav>

	{#each categories as cat}
		<section id={cat.id} class="category">
			<header class="category-head">
				<span class="category-icon {cat.icon}" aria-hidden="true"></span>
				<div class="category-title-block">
					<h3>{cat.title}</h3>
					<p class="category-when">{cat.when}</p>
				</div>
				<div class="basis-tag">
					<Tag variant="primary" size="sm">
						{cat.basis.article}
					</Tag>
					<span class="basis-label">{cat.basis.label}</span>
				</div>
			</header>

			<div class="field-table-wrapper">
				<table class="field-table">
					<thead>
						<tr>
							<th>{m.showcase_admin_data_col_field()}</th>
							<th>{m.showcase_admin_data_col_type()}</th>
							<th>{m.showcase_admin_data_col_example()}</th>
						</tr>
					</thead>
					<tbody>
						{#each cat.rows as row}
							<tr>
								<td><code class="field-name">{row.field}</code></td>
								<td><code class="field-type">{row.type}</code></td>
								<td>
									{#if row.example}<code class="field-example">{row.example}</code>{/if}
									{#if row.example && row.note}<br />{/if}
									{#if row.note}<span class="field-note">{row.note}</span>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if cat.notes}
				<ul class="category-notes">
					{#each cat.notes as note}
						<li>{note}</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}

	<aside class="cross-link">
		<span class="i-lucide-arrow-right" aria-hidden="true"></span>
		<p>
			Want to verify in real time? See <a href="/showcases/analytics/privacy">Analytics → Privacy</a> for live
			counts of nullable fields per consent tier, or <a href="/showcases/analytics/my-data">My Data</a> to inspect
			what's recorded against your own visitor ID.
		</p>
	</aside>
</div>

<style>
	.data-page {
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

	.lede code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.anchor-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.anchor-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		text-decoration: none;
		transition: background-color 150ms;
	}

	.anchor-link:hover {
		background: var(--color-subtle);
	}

	.anchor-icon {
		width: 1rem;
		height: 1rem;
		color: var(--color-primary);
	}

	.category {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		scroll-margin-top: var(--spacing-7);
	}

	.category-head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--spacing-4);
		align-items: start;
	}

	@media (max-width: 640px) {
		.category-head {
			grid-template-columns: auto 1fr;
		}

		.basis-tag {
			grid-column: 1 / -1;
		}
	}

	.category-icon {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-primary);
	}

	.category-title-block h3 {
		margin: 0 0 var(--spacing-1) 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.category-when {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.basis-tag {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		align-items: flex-end;
	}

	.basis-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 500;
	}

	.field-table-wrapper {
		overflow-x: auto;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.field-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.field-table thead {
		background: var(--color-subtle);
	}

	.field-table th {
		text-align: left;
		padding: var(--spacing-3) var(--spacing-4);
		font-weight: 600;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid var(--color-border);
	}

	.field-table td {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
		color: var(--color-fg);
		line-height: 1.5;
	}

	.field-table tr:last-child td {
		border-bottom: none;
	}

	.field-name {
		font-family: ui-monospace, monospace;
		font-weight: 600;
		color: var(--color-fg);
	}

	.field-type {
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		font-size: 0.92em;
	}

	.field-example {
		font-family: ui-monospace, monospace;
		color: var(--color-fg);
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.field-note {
		display: inline-block;
		margin-top: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.category-notes {
		margin: 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.category-notes li + li {
		margin-top: var(--spacing-1);
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

	.cross-link a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
</style>
