<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

const principles = [
	{
		title: 'Data minimization',
		body: 'We collect the smallest amount of data that lets the site work. No raw IPs, no third-party trackers, no fingerprinting.',
		icon: 'i-lucide-minimize-2',
		article: 'Art. 5(1)(c)',
	},
	{
		title: 'Purpose limitation',
		body: 'Each field has one stated purpose — operate the site, prevent abuse, or respond to your feedback. Nothing is repurposed silently.',
		icon: 'i-lucide-target',
		article: 'Art. 5(1)(b)',
	},
	{
		title: 'Storage limitation',
		body: 'Telemetry deletes itself on a daily cron. Consent records keep the legally-required proof window. Feedback you sent stays until you ask us to remove it.',
		icon: 'i-lucide-timer',
		article: 'Art. 5(1)(e)',
	},
	{
		title: 'Transparency',
		body: 'This page is the accountability surface. Every category we collect is documented with its lawful basis, in plain language, before you have to ask.',
		icon: 'i-lucide-eye',
		article: 'Art. 5(1)(a)',
	},
];

const subPages = [
	{
		href: '/showcases/admin/data',
		icon: 'i-lucide-database',
		title: 'What we collect',
		body: 'Every field on every category, with the lawful basis spelled out.',
	},
	{
		href: '/showcases/admin/retention',
		icon: 'i-lucide-timer',
		title: 'How long we keep it',
		body: `Live retention values from config — events ${data.retention.events}d, consent ${data.retention.consent}d.`,
	},
	{
		href: '/showcases/admin/rights',
		icon: 'i-lucide-scale',
		title: 'Your rights',
		body: 'Access, erasure, objection — and how to exercise them.',
	},
	{
		href: '/showcases/admin/cookies',
		icon: 'i-lucide-cookie',
		title: 'Cookies',
		body: 'The full inventory: name, category, duration, purpose.',
	},
	{
		href: '/showcases/admin/powers',
		icon: 'i-lucide-shield-check',
		title: 'Admin powers',
		body: 'What the operator can see and change — and how every write is audited.',
	},
];
</script>

<svelte:head>
	<meta
		name="description"
		content="How v10r.dev handles your data: controller, lawful basis, retention, your rights."
	/>
</svelte:head>

<div class="overview">
	<section class="hero">
		<h2 class="hero-title">A single operator, four principles, one place to verify them.</h2>
		<p class="hero-body">
			v10r.dev is a code template hosted by one person. The controller below decides what happens to your data,
			and bears legal responsibility for it. Everything on the next five pages is derived from the live codebase
			— if a retention value changes in <code>src/lib/server/config.ts</code>, the number on this page changes too.
		</p>
	</section>

	<section class="controller">
		<header class="section-head">
			<h3 class="section-title">{m.showcase_admin_section_controller()}</h3>
			<Tag variant="muted" size="sm" label="GDPR Art. 13(1)(a)" />
		</header>
		<dl class="controller-grid">
			<div class="controller-row">
				<dt>Identity</dt>
				<dd>Stas K. (sole operator of v10r.dev)</dd>
			</div>
			<div class="controller-row">
				<dt>Contact</dt>
				<dd><a href="mailto:{data.controllerEmail}">{data.controllerEmail}</a></dd>
			</div>
			<div class="controller-row">
				<dt>Scope</dt>
				<dd>v10r is a public-facing template / sandbox. There is no commercial processing, no advertising network, and no third-party analytics shipped to the browser.</dd>
			</div>
			<div class="controller-row">
				<dt>Supervisory authority</dt>
				<dd>
					<a href="https://www.bfdi.bund.de" target="_blank" rel="noreferrer noopener">
						BfDI — Federal Commissioner for Data Protection
					</a>
					<span class="muted">(Germany). You may also file with the authority of your habitual residence.</span>
				</dd>
			</div>
		</dl>
	</section>

	<section class="principles">
		<header class="section-head">
			<h3 class="section-title">{m.showcase_admin_section_principles()}</h3>
			<Tag variant="muted" size="sm" label="GDPR Art. 5" />
		</header>
		<div class="principle-grid">
			{#each principles as p}
				<article class="principle-card">
					<span class="principle-icon {p.icon}" aria-hidden="true"></span>
					<div class="principle-body">
						<h4>{p.title} <span class="article">{p.article}</span></h4>
						<p>{p.body}</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="subpages">
		<header class="section-head">
			<h3 class="section-title">{m.showcase_admin_section_subpages()}</h3>
		</header>
		<div class="subpage-grid">
			{#each subPages as s}
				<a class="subpage-card" href={s.href}>
					<span class="subpage-icon {s.icon}" aria-hidden="true"></span>
					<h4>{s.title}</h4>
					<p>{s.body}</p>
					<span class="subpage-arrow i-lucide-arrow-right" aria-hidden="true"></span>
				</a>
			{/each}
		</div>
	</section>

	<aside class="disclaimer">
		<span class="i-lucide-info" aria-hidden="true"></span>
		<p>
			v10r is a code template; this page describes the data handling of the operator running v10r.dev.
			It is not legal advice. If you fork v10r and run your own deployment, you become the controller
			for your visitors and must adapt this page to reflect your jurisdiction and processing.
		</p>
	</aside>
</div>

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.hero {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		max-width: 65ch;
	}

	.hero-title {
		font-size: var(--text-fluid-xl);
		font-weight: 600;
		line-height: 1.25;
		color: var(--color-fg);
		margin: 0;
	}

	.hero-body {
		font-size: var(--text-fluid-base);
		line-height: 1.6;
		color: var(--color-muted);
		margin: 0;
	}

	.hero-body code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-4);
	}

	.section-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0;
	}

	.controller-grid {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		margin: 0;
	}

	.controller-row {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: var(--spacing-4);
		padding: var(--spacing-4) var(--spacing-5);
		border-bottom: 1px solid var(--color-border);
	}

	.controller-row:last-child {
		border-bottom: none;
	}

	.controller-row dt {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.controller-row dd {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.5;
	}

	.controller-row dd .muted {
		color: var(--color-muted);
	}

	.controller-row dd a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	@media (max-width: 640px) {
		.controller-row {
			grid-template-columns: 1fr;
			gap: var(--spacing-1);
		}
	}

	.principle-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.principle-grid {
			grid-template-columns: 1fr;
		}
	}

	.principle-card {
		display: flex;
		gap: var(--spacing-4);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.principle-icon {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-primary);
	}

	.principle-body h4 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-2);
		margin: 0 0 var(--spacing-2) 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.principle-body .article {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 500;
		font-family: ui-monospace, monospace;
	}

	.principle-body p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.subpage-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--spacing-3);
	}

	.subpage-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4) var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		text-decoration: none;
		color: inherit;
		transition: border-color 150ms, transform 150ms;
	}

	.subpage-card:hover {
		border-color: var(--color-primary);
		transform: translateY(-1px);
	}

	.subpage-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.subpage-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
	}

	.subpage-card h4 {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.subpage-card p {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.subpage-arrow {
		position: absolute;
		top: var(--spacing-4);
		right: var(--spacing-5);
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
		opacity: 0;
		transition: opacity 150ms, transform 150ms;
	}

	.subpage-card:hover .subpage-arrow {
		opacity: 1;
		transform: translateX(2px);
	}

	.disclaimer {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.disclaimer span {
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.15rem;
		color: var(--color-muted);
	}

	.disclaimer p {
		margin: 0;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		color: var(--color-muted);
	}
</style>
