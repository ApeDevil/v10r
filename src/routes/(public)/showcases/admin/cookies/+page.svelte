<script lang="ts">
import { Tag } from '$lib/components/primitives/tag';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

interface CookieRow {
	name: string;
	category: 'strictly-necessary' | 'analytics';
	categoryLabel: string;
	categoryVariant: 'success' | 'primary';
	duration: string;
	purpose: string;
	setBy: string;
	httpOnly: boolean;
	secure: boolean;
	sameSite: 'Lax' | 'Strict' | 'None';
}

const cookies: CookieRow[] = [
	{
		name: data.consentCookieName,
		category: 'strictly-necessary',
		categoryLabel: 'Strictly necessary',
		categoryVariant: 'success',
		duration: `${data.consentCookieDays} days (~6 months)`,
		purpose:
			"Stores your cookie-banner choice (necessary / analytics / full) so we don't re-prompt you on every page. Without this cookie, the banner cannot remember your decision — that is why it qualifies as strictly necessary under ePrivacy Art. 5(3).",
		setBy: 'Server, on consent decision',
		httpOnly: false,
		secure: true,
		sameSite: 'Lax',
	},
	{
		name: '_v10r_sid',
		category: 'analytics',
		categoryLabel: 'Analytics (consent-gated)',
		categoryVariant: 'primary',
		duration: '30 minutes (rolling) — extended on activity, deleted on tab close',
		purpose:
			'A short, opaque session ID that lets us reconstruct the page-by-page journey for the consented session. Cleared when you reject analytics or close the tab.',
		setBy: 'Server, only after analytics consent',
		httpOnly: true,
		secure: true,
		sameSite: 'Lax',
	},
	{
		name: 'better-auth.session_token',
		category: 'strictly-necessary',
		categoryLabel: 'Strictly necessary',
		categoryVariant: 'success',
		duration: 'Session — cleared on logout or expiry',
		purpose: 'Authenticates you to the protected /app surface after sign-in. Set by Better Auth.',
		setBy: 'Server, on successful sign-in',
		httpOnly: true,
		secure: true,
		sameSite: 'Lax',
	},
];
</script>
<div class="cookies">
	<header class="lede">
		<h2>{m.showcase_admin_cookies_heading()}</h2>
		<p>
			ePrivacy Art. 5(3) and TTDSG §25 require informed consent for any cookie that isn't strictly necessary.
			Below is the complete inventory — name, duration, purpose, and which ones we set without asking.
			There are no third-party cookies.
		</p>
	</header>

	<div class="cookie-list">
		{#each cookies as cookie}
			<article class="cookie-card">
				<header class="cookie-head">
					<code class="cookie-name">{cookie.name}</code>
					<Tag variant={cookie.categoryVariant} size="sm" label={cookie.categoryLabel} />
				</header>

				<dl class="cookie-meta">
					<div>
						<dt>Duration</dt>
						<dd>{cookie.duration}</dd>
					</div>
					<div>
						<dt>Set by</dt>
						<dd>{cookie.setBy}</dd>
					</div>
					<div>
						<dt>HttpOnly</dt>
						<dd>
							<Tag variant={cookie.httpOnly ? 'success' : 'muted'} size="sm" label={cookie.httpOnly ? 'true' : 'false'} />
						</dd>
					</div>
					<div>
						<dt>Secure</dt>
						<dd>
							<Tag variant={cookie.secure ? 'success' : 'muted'} size="sm" label={cookie.secure ? 'true' : 'false'} />
						</dd>
					</div>
					<div>
						<dt>SameSite</dt>
						<dd><code class="samesite">{cookie.sameSite}</code></dd>
					</div>
				</dl>

				<p class="cookie-purpose">{cookie.purpose}</p>
			</article>
		{/each}
	</div>

	<section class="absent">
		<header class="section-head">
			<h3>{m.showcase_admin_cookies_not_used()}</h3>
			<Tag variant="muted" size="sm" label="By design" />
		</header>
		<ul class="absent-list">
			<li><span class="i-lucide-x text-icon-sm" aria-hidden="true"></span> No Google Analytics, Plausible, Posthog, or any third-party analytics script.</li>
			<li><span class="i-lucide-x text-icon-sm" aria-hidden="true"></span> No advertising cookies, no retargeting pixels, no Facebook / LinkedIn / Twitter beacons.</li>
			<li><span class="i-lucide-x text-icon-sm" aria-hidden="true"></span> No cross-site tracking. SameSite=Lax on every cookie we do set.</li>
			<li><span class="i-lucide-x text-icon-sm" aria-hidden="true"></span> No browser fingerprinting (we don't read canvas, audio, fonts, or screen geometry).</li>
			<li><span class="i-lucide-x text-icon-sm" aria-hidden="true"></span> No localStorage trackers. The only client storage used is what Better Auth needs for sign-in.</li>
		</ul>
	</section>

	<aside class="banner-link">
		<span class="i-lucide-cookie" aria-hidden="true"></span>
		<p>
			Want to change your choice right now? Open the cookie banner — accepting and rejecting are
			equally one click. We don't pre-tick boxes. We don't bury the reject button in a third layer.
		</p>
	</aside>
</div>

<style>
	.cookies {
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

	.cookie-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.cookie-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.cookie-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
	}

	.cookie-name {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
		padding: 0.15em 0.5em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.cookie-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--spacing-3);
		margin: 0;
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.cookie-meta div {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.cookie-meta dt {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cookie-meta dd {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.samesite {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.cookie-purpose {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
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

	.absent-list {
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

	.absent-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.absent-list li span {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
	}

	.banner-link {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.banner-link span {
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.15rem;
		color: var(--color-primary);
	}

	.banner-link p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.6;
	}
</style>
