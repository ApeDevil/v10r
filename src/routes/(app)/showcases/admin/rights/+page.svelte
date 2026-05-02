<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';

let { data } = $props();

interface Right {
	article: string;
	title: string;
	icon: string;
	what: string;
	how: string;
	expect: string;
}

const rights: Right[] = [
	{
		article: 'Art. 15',
		title: 'Right of access',
		icon: 'i-lucide-file-text',
		what: 'A copy of the personal data we hold about you, plus the metadata required by Art. 15(1)(a–h): purposes, categories, recipients, retention, sources, and the existence of automated decision-making.',
		how: `Email ${data.controllerEmail} from the address you used (or include the visitor ID hash you'd like inspected).`,
		expect: 'Reply within one month (Art. 12(3)).',
	},
	{
		article: 'Art. 16',
		title: 'Right to rectification',
		icon: 'i-lucide-pencil',
		what: 'Correction of inaccurate personal data, or completion of incomplete data.',
		how: `Email ${data.controllerEmail} with the field and the correct value.`,
		expect: 'Correction without undue delay; recipients informed where applicable.',
	},
	{
		article: 'Art. 17',
		title: 'Right to erasure',
		icon: 'i-lucide-trash-2',
		what: 'Deletion of personal data — feedback you submitted, an account you created, or telemetry rows still inside the retention window.',
		how: `Email ${data.controllerEmail} stating what you'd like deleted.`,
		expect: 'Deletion within one month, except where law requires retention. Confirmation by reply.',
	},
	{
		article: 'Art. 18',
		title: 'Right to restriction',
		icon: 'i-lucide-pause',
		what: 'Pause processing while accuracy or lawfulness is being verified.',
		how: 'Email the controller with the field and reason.',
		expect: 'Processing limited to storage until the dispute is resolved.',
	},
	{
		article: 'Art. 20',
		title: 'Right to portability',
		icon: 'i-lucide-download',
		what: 'A machine-readable export of personal data you provided directly (e.g. feedback you wrote, account email).',
		how: `Email ${data.controllerEmail} requesting an export.`,
		expect: 'Reply with a JSON file. Anonymised telemetry is out of scope (no longer "personal data" once hashed).',
	},
	{
		article: 'Art. 21',
		title: 'Right to object',
		icon: 'i-lucide-shield-alert',
		what: 'Object to processing based on legitimate interests — for example, the pre-consent traffic counter described in /showcases/admin/data.',
		how: 'Open the cookie banner and click "Reject all", or email the controller for a global opt-out.',
		expect: 'Pre-consent collection stops on the next request; existing rows expire normally per the retention table.',
	},
	{
		article: 'Art. 7(3)',
		title: 'Right to withdraw consent',
		icon: 'i-lucide-x-circle',
		what: 'Withdraw analytics or full-tier consent at any time. Withdrawal is as easy as giving consent (Art. 7(3) explicitly).',
		how: 'Re-open the cookie banner and toggle off. The session cookie clears immediately.',
		expect: 'Past processing remains lawful; future processing stops at the next request.',
	},
	{
		article: 'Art. 77',
		title: 'Right to lodge a complaint',
		icon: 'i-lucide-gavel',
		what: 'Complain to a supervisory authority if you believe the processing infringes the GDPR.',
		how: 'File with the BfDI (Germany) or the supervisory authority of your habitual residence.',
		expect: 'Independent review by the regulator.',
	},
];
</script>
<div class="rights">
	<header class="lede">
		<h2>Eight rights, one inbox.</h2>
		<p>
			These are not user requests we hope you'll never make — they're features the GDPR builds in for you,
			and we honour them in plain text. The contact for every right below is
			<a href="mailto:{data.controllerEmail}"><code>{data.controllerEmail}</code></a>.
		</p>
	</header>

	<div class="rights-grid">
		{#each rights as right}
			<article class="right-card">
				<header class="right-head">
					<span class="right-icon {right.icon}" aria-hidden="true"></span>
					<div class="right-title-block">
						<Tag variant="muted" size="sm" label={right.article} />
						<h3>{right.title}</h3>
					</div>
				</header>

				<dl class="right-body">
					<div>
						<dt>What it is</dt>
						<dd>{right.what}</dd>
					</div>
					<div>
						<dt>How to exercise</dt>
						<dd>{right.how}</dd>
					</div>
					<div>
						<dt>What to expect</dt>
						<dd>{right.expect}</dd>
					</div>
				</dl>
			</article>
		{/each}
	</div>

	<aside class="see-also">
		<header>
			<span class="i-lucide-eye" aria-hidden="true"></span>
			<h3>See it live</h3>
		</header>
		<p>
			<a href="/showcases/analytics/my-data">/showcases/analytics/my-data</a> shows the rows currently
			associated with your visitor ID hash — what an Art. 15 access request would actually return today.
			It's the cheapest way to verify "you have nothing dangerous about me" before deciding whether to
			send a deletion request.
		</p>
	</aside>

	<aside class="complaint">
		<header>
			<span class="i-lucide-scale" aria-hidden="true"></span>
			<h3>Supervisory authority</h3>
		</header>
		<p>
			Germany — <a href="https://www.bfdi.bund.de" target="_blank" rel="noreferrer noopener">
				BfDI: Federal Commissioner for Data Protection and Freedom of Information
			</a>. You may also file with the authority of your EU/EEA habitual residence; both are valid under
			Art. 77 GDPR.
		</p>
	</aside>
</div>

<style>
	.rights {
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

	.lede a,
	.see-also a,
	.complaint a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.lede code {
		font-family: ui-monospace, monospace;
		font-size: 0.95em;
	}

	.rights-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.rights-grid {
			grid-template-columns: 1fr;
		}
	}

	.right-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.right-head {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
	}

	.right-icon {
		flex-shrink: 0;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-primary);
	}

	.right-title-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.right-title-block h3 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.right-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin: 0;
	}

	.right-body div {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.right-body dt {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.right-body dd {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.55;
	}

	.see-also,
	.complaint {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.see-also header,
	.complaint header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.see-also header span,
	.complaint header span {
		width: 1.125rem;
		height: 1.125rem;
		color: var(--color-primary);
	}

	.see-also h3,
	.complaint h3 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.see-also p,
	.complaint p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}
</style>
