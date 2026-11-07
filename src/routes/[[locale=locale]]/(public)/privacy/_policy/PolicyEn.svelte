<script lang="ts">
/** English translation of the privacy policy. Mirrors PolicyDe.svelte section by section; German is binding. */
import { localizeHref } from '#lib/i18n/index.ts';
import { type PolicyFacts, reviewedOn } from './policy-facts.ts';

let { operator, cookieNames, retention }: PolicyFacts = $props();

const REVIEWED_ON = reviewedOn('en-GB');

const cookies = $derived([
	{
		name: cookieNames.consent,
		purpose: 'Stores your choice in the cookie banner.',
		duration: `${cookieNames.consentDays} days`,
		basis: 'strictly necessary, § 25(2) TDDDG',
	},
	{
		name: cookieNames.session,
		purpose: 'Links the page views of one visit together.',
		duration: '30 minutes, extended on activity',
		basis: 'consent, § 25(1) TDDDG',
	},
	{
		name: 'better-auth.session_token',
		purpose: 'Keeps you signed in after you log in.',
		duration: 'until you log out or the session expires',
		basis: 'strictly necessary, § 25(2) TDDDG',
	},
	{
		name: 'discord_oauth_state',
		purpose: 'Protects linking a Discord account for notifications against forgery.',
		duration: '10 minutes',
		basis: 'strictly necessary, § 25(2) TDDDG',
	},
	{
		name: 'theme, PARAGLIDE_LOCALE, v10r_style, sidebar-width',
		purpose: 'Remember your colour scheme, language, display style and sidebar width.',
		duration: 'up to 1 year',
		basis: 'explicitly requested by you, § 25(2) TDDDG',
	},
]);

const recipients = [
	{ name: 'Vercel Inc., USA', role: 'website hosting, server logs, Web Analytics (only after consent)' },
	{ name: 'Neon Inc., USA', role: 'database (accounts, statistics, feedback, AI conversations)' },
	{ name: 'Upstash Inc., USA', role: 'cache and abuse protection (rate limiting)' },
	{ name: 'Cloudflare Inc., USA', role: 'file storage (R2) for files of signed-in users' },
	{ name: 'Neo4j Inc., USA', role: 'graph database (Aura) for showcase data' },
	{ name: 'Resend Inc., USA', role: 'sending emails (sign-in links, notifications)' },
	{ name: 'Discord Inc., USA; Telegram FZ-LLC, UAE', role: 'delivering notifications, only if you link them' },
	{ name: 'Groq Inc., OpenAI LLC, Google LLC (all USA)', role: 'processing AI requests' },
	{ name: 'Render Services Inc., USA (servers in Frankfurt)', role: 'running a sample service; receives no user data' },
];
</script>

<section>
	<h2>1. Controller</h2>
	<address>
		{operator.name}<br />
		{operator.street}<br />
		{operator.postalCode} {operator.city}<br />
		{operator.country}<br />
		Email: <a href="mailto:{operator.email}">{operator.email}</a>
	</address>
	<p>
		v10r.dev is run by a private individual without commercial intent. No data protection officer has been
		appointed, and none is required by law.
	</p>
</section>

<section>
	<h2>2. The essentials</h2>
	<p>
		There is no advertising, no third-party tracking before your consent and no fingerprinting. IP addresses are
		not stored in the database. An account is optional; the public pages work without signing in. The
		<a href={localizeHref('/showcases/privacy')}>privacy showcase</a> shows how the processing described here is
		implemented.
	</p>
</section>

<section>
	<h2>3. Hosting and server logs</h2>
	<p>
		The website is hosted by Vercel Inc. On every request Vercel processes the technically necessary connection
		data (IP address, time, requested address, browser identifier) to deliver the page and keep the service
		secure.
	</p>
	<p class="basis">Legal basis: Art. 6(1)(f) GDPR (secure and stable operation).</p>
</section>

<section>
	<h2>4. Visit statistics without consent</h2>
	<p>
		So that visits can be counted and abuse detected, one record is stored per page view: an irreversible
		identifier (a keyed hash of IP address and browser identifier; the IP address itself is not stored), the
		requested path without parameters, the time, the country and a coarse network class (for example, data
		centre). Bots are filtered out before anything is stored.
	</p>
	<p class="basis">
		Legal basis: Art. 6(1)(f) GDPR. Storage period: {retention.events} days; after that only daily totals without
		any personal reference remain.
	</p>
</section>

<section>
	<h2>5. Analytics with consent</h2>
	<p>
		Only if you agree to analytics in the cookie banner are your device type, browser, referring site (domain
		only) and your path through the website also recorded, using a session cookie. Vercel Web Analytics is then
		loaded as well; it sends page addresses and coarse location data to Vercel and sets no cookies.
	</p>
	<p>
		Your decision is logged with a timestamp so that the consent can be demonstrated (Art. 7(1) GDPR). You can
		withdraw it at any time through "Cookie preferences" in the footer; collection then stops with the next
		request.
	</p>
	<p class="basis">
		Legal basis: Art. 6(1)(a) GDPR, § 25(1) TDDDG. Storage period: visit data {retention.events} days, consent
		records {retention.consent} days.
	</p>
</section>

<section>
	<h2>6. Cookies and local storage</h2>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Purpose</th>
					<th>Duration</th>
					<th>Basis</th>
				</tr>
			</thead>
			<tbody>
				{#each cookies as cookie}
					<tr>
						<td><code>{cookie.name}</code></td>
						<td>{cookie.purpose}</td>
						<td>{cookie.duration}</td>
						<td>{cookie.basis}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section>
	<h2>7. User account</h2>
	<p>
		If you create an account, your email address, a password hash (never the password itself), your sessions
		and a log of security-relevant events (sign-in, sign-out, password change) are stored. If you sign in with
		GitHub or Google, we receive your account identifier, name and email address from that provider. If you
		link a Discord or Telegram account for notifications, we store its identifier. Sign-in links and
		notifications are sent through Resend. Content you create in your account stays stored until you delete it
		or the account.
	</p>
	<p class="basis">
		Legal basis: Art. 6(1)(b) GDPR (providing the account); for the security log, Art. 6(1)(f) GDPR. Usage
		statistics in the account: {retention.userEvents} days. Deleting the account removes the associated data.
	</p>
</section>

<section>
	<h2>8. Feedback form</h2>
	<p>
		If you submit the feedback form, the subject, message, an optional rating, an optional email address for
		follow-up questions and the page you came from are stored. The message stays stored until you ask for it to
		be deleted.
	</p>
	<p class="basis">Legal basis: Art. 6(1)(f) GDPR (answering your message).</p>
</section>

<section>
	<h2>9. AI features</h2>
	<p>
		If you use the AI chat or other AI features, your input is sent to one of the AI providers Groq, OpenAI or
		Google to answer it. Please do not enter sensitive personal data there. The conversation is stored to run
		the service and investigate errors.
	</p>
	<p class="basis">
		Legal basis: Art. 6(1)(f) GDPR, for signed-in users Art. 6(1)(b). Storage period: the texts are removed after
		{retention.aiTurnBodies} days, the remaining metadata is deleted after {retention.aiTurns} days.
	</p>
</section>

<section>
	<h2>10. Name check</h2>
	<p>
		If you check a name, it is sent to the EUIPO trade mark register, the GLEIF LEI index, the domain registries
		of the checked extensions and a web-search provider (Tavily or Brave), and then discarded. The name is not
		stored in a database; a hash of the name serves as a cache key for up to 24 hours.
	</p>
	<p class="basis">Legal basis: Art. 6(1)(f) GDPR (answering your request).</p>
</section>

<section>
	<h2>11. Abuse protection</h2>
	<p>
		Forms and interfaces are protected by rate limiting, which keeps your IP address in the cache (Upstash) for
		at most 60 seconds, and in places by a computational challenge (ALTCHA) that runs on this server without any
		third party.
	</p>
	<p class="basis">Legal basis: Art. 6(1)(f) GDPR (protection against abuse).</p>
</section>

<section>
	<h2>12. Recipients and transfers to third countries</h2>
	<p>The following service providers process data on our behalf (Art. 28 GDPR):</p>
	<ul>
		{#each recipients as recipient}
			<li><strong>{recipient.name}</strong>: {recipient.role}</li>
		{/each}
	</ul>
	<p>
		For providers based in the USA, transfers rely on the EU-U.S. Data Privacy Framework where the provider is
		certified, and otherwise on the EU Standard Contractual Clauses (Art. 46(2)(c) GDPR).
	</p>
</section>

<section>
	<h2>13. Your rights</h2>
	<p>
		You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing
		(Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21
		GDPR). You can withdraw consent at any time with effect for the future. Signed-in users can view, export and
		delete their data in their account themselves; send any other request to
		<a href="mailto:{operator.email}">{operator.email}</a>.
	</p>
	<p>
		You can lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), for example the one
		responsible for us, the
		<a href="https://www.ldi.nrw.de" target="_blank" rel="noreferrer noopener">
			State Commissioner for Data Protection and Freedom of Information of North Rhine-Westphalia
		</a>.
	</p>
	<p>
		There is no automated decision-making or profiling under Art. 22 GDPR. You are not obliged to provide any
		data; without connection data, however, the website cannot be delivered.
	</p>
</section>

<section>
	<p class="note">Last reviewed: {REVIEWED_ON}</p>
</section>
