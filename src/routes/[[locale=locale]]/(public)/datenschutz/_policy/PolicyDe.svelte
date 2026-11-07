<script lang="ts">
/** The German privacy policy — the legally binding version. The translations mirror it section by section. */
import { localizeHref } from '#lib/i18n/index.ts';
import { type PolicyFacts, reviewedOn } from './policy-facts.ts';

let { operator, cookieNames, retention }: PolicyFacts = $props();

const REVIEWED_ON = reviewedOn('de-DE');

const cookies = $derived([
	{
		name: cookieNames.consent,
		purpose: 'Speichert Ihre Auswahl im Cookie-Banner.',
		duration: `${cookieNames.consentDays} Tage`,
		basis: 'technisch notwendig, § 25 Abs. 2 TDDDG',
	},
	{
		name: cookieNames.session,
		purpose: 'Ordnet die Seitenaufrufe eines Besuchs einander zu.',
		duration: '30 Minuten, verlängert bei Aktivität',
		basis: 'Einwilligung, § 25 Abs. 1 TDDDG',
	},
	{
		name: 'better-auth.session_token',
		purpose: 'Hält Sie nach der Anmeldung angemeldet.',
		duration: 'bis Abmeldung oder Ablauf der Sitzung',
		basis: 'technisch notwendig, § 25 Abs. 2 TDDDG',
	},
	{
		name: 'discord_oauth_state',
		purpose: 'Schützt die Verknüpfung eines Discord-Kontos für Benachrichtigungen vor Fälschung.',
		duration: '10 Minuten',
		basis: 'technisch notwendig, § 25 Abs. 2 TDDDG',
	},
	{
		name: 'theme, PARAGLIDE_LOCALE, v10r_style, sidebar-width',
		purpose: 'Merken Farbschema, Sprache, Darstellungsstil und Seitenleistenbreite.',
		duration: 'bis zu 1 Jahr',
		basis: 'vom Nutzer ausdrücklich gewünscht, § 25 Abs. 2 TDDDG',
	},
]);

const recipients = [
	{ name: 'Vercel Inc., USA', role: 'Hosting der Website, Server-Logs, Web Analytics (nur nach Einwilligung)' },
	{ name: 'Neon Inc., USA', role: 'Datenbank (Konten, Statistik, Feedback, KI-Verläufe)' },
	{ name: 'Upstash Inc., USA', role: 'Zwischenspeicher und Missbrauchsschutz (Ratenbegrenzung)' },
	{ name: 'Cloudflare Inc., USA', role: 'Dateispeicher (R2) für Dateien angemeldeter Nutzer' },
	{ name: 'Neo4j Inc., USA', role: 'Graphdatenbank (Aura) für Showcase-Daten' },
	{ name: 'Resend Inc., USA', role: 'Versand von E-Mails (Anmeldelinks, Benachrichtigungen)' },
	{
		name: 'Discord Inc., USA; Telegram FZ-LLC, VAE',
		role: 'Zustellung von Benachrichtigungen, nur wenn Sie das verknüpfen',
	},
	{ name: 'Groq Inc., OpenAI LLC, Google LLC (alle USA)', role: 'Verarbeitung von KI-Anfragen' },
	{
		name: 'Render Services Inc., USA (Server in Frankfurt)',
		role: 'Betrieb eines Beispieldienstes; erhält keine Nutzerdaten',
	},
];
</script>

<section>
	<h2>1. Verantwortlicher</h2>
	<address>
		{operator.name}<br />
		{operator.street}<br />
		{operator.postalCode} {operator.city}<br />
		{operator.country}<br />
		E-Mail: <a href="mailto:{operator.email}">{operator.email}</a>
	</address>
	<p>
		v10r.dev wird von einer Privatperson ohne kommerzielle Absicht betrieben. Ein
		Datenschutzbeauftragter ist nicht bestellt und gesetzlich nicht vorgeschrieben.
	</p>
</section>

<section>
	<h2>2. Das Wichtigste vorab</h2>
	<p>
		Es gibt keine Werbung, kein Tracking durch Dritte vor Ihrer Einwilligung und kein
		Fingerprinting. IP-Adressen werden nicht in der Datenbank gespeichert. Ein Konto ist
		freiwillig; die öffentlichen Seiten funktionieren ohne Anmeldung. Wie die hier beschriebene
		Verarbeitung technisch umgesetzt ist, zeigt der
		<a href={localizeHref('/showcases/privacy')}>Privacy-Showcase</a>.
	</p>
</section>

<section>
	<h2>3. Hosting und Server-Logs</h2>
	<p>
		Die Website wird bei Vercel Inc. gehostet. Bei jedem Aufruf verarbeitet Vercel technisch
		notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung),
		um die Seite auszuliefern und den Betrieb abzusichern.
	</p>
	<p class="basis">Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb).</p>
</section>

<section>
	<h2>4. Besuchsstatistik ohne Einwilligung</h2>
	<p>
		Damit Besuche gezählt und Missbrauch erkannt werden kann, wird für jeden Seitenaufruf ein
		Datensatz gespeichert: eine nicht umkehrbare Kennung (verschlüsselter Hash aus IP-Adresse und
		Browserkennung; die IP-Adresse selbst wird nicht gespeichert), der aufgerufene Pfad ohne
		Parameter, der Zeitpunkt, das Land und eine grobe Netzklasse (z. B. Rechenzentrum). Bots
		werden vor dem Speichern herausgefiltert.
	</p>
	<p class="basis">
		Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Speicherdauer: {retention.events} Tage; danach
		bleiben nur Tagessummen ohne Personenbezug.
	</p>
</section>

<section>
	<h2>5. Analyse mit Einwilligung</h2>
	<p>
		Nur wenn Sie im Cookie-Banner der Analyse zustimmen, werden zusätzlich Gerätetyp, Browser,
		die Herkunftsseite (nur die Domain) und der Weg durch die Website über ein Sitzungs-Cookie
		erfasst. Außerdem wird dann Vercel Web Analytics geladen, das Seitenadressen und grobe
		Standortdaten an Vercel übermittelt und keine Cookies setzt.
	</p>
	<p>
		Ihre Entscheidung wird mit Zeitpunkt protokolliert, damit die Einwilligung nachweisbar ist
		(Art. 7 Abs. 1 DSGVO). Sie können sie jederzeit über „Cookie preferences“ in der Fußzeile
		widerrufen; die Erfassung endet dann mit der nächsten Anfrage.
	</p>
	<p class="basis">
		Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG. Speicherdauer: Besuchsdaten
		{retention.events} Tage, Einwilligungsnachweise {retention.consent} Tage.
	</p>
</section>

<section>
	<h2>6. Cookies und lokale Speicherung</h2>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Zweck</th>
					<th>Dauer</th>
					<th>Grundlage</th>
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
	<h2>7. Benutzerkonto</h2>
	<p>
		Wenn Sie ein Konto anlegen, werden Ihre E-Mail-Adresse, ein Passwort-Hash (nie das Passwort
		selbst), Ihre Sitzungen und ein Protokoll sicherheitsrelevanter Ereignisse (Anmeldung,
		Abmeldung, Passwortänderung) gespeichert. Bei Anmeldung über GitHub oder Google erhalten wir von
		dem Anbieter Ihre Kontokennung, Ihren Namen und Ihre E-Mail-Adresse. Verknüpfen Sie für
		Benachrichtigungen ein Discord- oder Telegram-Konto, speichern wir dessen Kennung. Anmeldelinks und Benachrichtigungen
		werden über Resend versendet. Inhalte, die Sie im Konto anlegen, bleiben gespeichert, bis Sie
		sie oder das Konto löschen.
	</p>
	<p class="basis">
		Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des Kontos), für das
		Sicherheitsprotokoll Art. 6 Abs. 1 lit. f DSGVO. Nutzungsstatistik im Konto:
		{retention.userEvents} Tage. Mit der Löschung des Kontos werden die zugehörigen Daten entfernt.
	</p>
</section>

<section>
	<h2>8. Feedback-Formular</h2>
	<p>
		Wenn Sie das Feedback-Formular absenden, werden Betreff, Nachricht, optional eine Bewertung
		und eine E-Mail-Adresse für Rückfragen sowie die Seite gespeichert, von der Sie kamen. Die
		Nachricht bleibt gespeichert, bis Sie ihre Löschung verlangen.
	</p>
	<p class="basis">Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Beantwortung Ihrer Nachricht).</p>
</section>

<section>
	<h2>9. KI-Funktionen</h2>
	<p>
		Wenn Sie den KI-Chat oder andere KI-Funktionen nutzen, wird Ihre Eingabe zur Beantwortung an
		einen der KI-Anbieter Groq, OpenAI oder Google übermittelt. Bitte geben Sie dort keine
		sensiblen personenbezogenen Daten ein. Der Verlauf wird gespeichert, um den Dienst zu
		betreiben und Fehler zu untersuchen.
	</p>
	<p class="basis">
		Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO, bei angemeldeten Nutzern lit. b. Speicherdauer:
		die Texte werden nach {retention.aiTurnBodies} Tagen entfernt, die übrigen Metadaten nach
		{retention.aiTurns} Tagen gelöscht.
	</p>
</section>

<section>
	<h2>10. Namensprüfung</h2>
	<p>
		Wenn Sie einen Namen prüfen, wird er an das Markenregister der EUIPO, den LEI-Index der
		GLEIF, die Domain-Registries der geprüften Endungen und einen Websuche-Anbieter (Tavily oder
		Brave) übermittelt und anschließend verworfen. Der Name wird nicht in einer Datenbank
		gespeichert; ein Hash des Namens dient bis zu 24 Stunden als Zwischenspeicher-Schlüssel.
	</p>
	<p class="basis">Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Beantwortung Ihrer Anfrage).</p>
</section>

<section>
	<h2>11. Missbrauchsschutz</h2>
	<p>
		Formulare und Schnittstellen sind durch eine Ratenbegrenzung geschützt, die Ihre IP-Adresse
		für höchstens 60 Sekunden im Zwischenspeicher (Upstash) hält, und teilweise durch eine
		Rechenaufgabe (ALTCHA), die ohne Drittanbieter auf diesem Server läuft.
	</p>
	<p class="basis">Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz vor Missbrauch).</p>
</section>

<section>
	<h2>12. Empfänger und Übermittlung in Drittländer</h2>
	<p>Folgende Dienstleister verarbeiten Daten in unserem Auftrag (Art. 28 DSGVO):</p>
	<ul>
		{#each recipients as recipient}
			<li><strong>{recipient.name}</strong>: {recipient.role}</li>
		{/each}
	</ul>
	<p>
		Bei Anbietern mit Sitz in den USA erfolgt die Übermittlung auf Grundlage des
		EU-U.S. Data Privacy Framework, soweit der Anbieter zertifiziert ist, im Übrigen auf Grundlage
		der EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
	</p>
</section>

<section>
	<h2>13. Ihre Rechte</h2>
	<p>
		Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
		Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
		gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO). Eine Einwilligung
		können Sie jederzeit mit Wirkung für die Zukunft widerrufen. Angemeldete Nutzer können ihre
		Daten im Konto selbst einsehen, exportieren und löschen; alle anderen Anfragen richten Sie an
		<a href="mailto:{operator.email}">{operator.email}</a>.
	</p>
	<p>
		Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), etwa bei
		der für uns zuständigen
		<a href="https://www.ldi.nrw.de" target="_blank" rel="noreferrer noopener">
			Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen
		</a>.
	</p>
	<p>
		Eine automatisierte Entscheidungsfindung oder ein Profiling nach Art. 22 DSGVO findet nicht
		statt. Sie sind nicht verpflichtet, Daten bereitzustellen; ohne Verbindungsdaten kann die
		Website jedoch nicht ausgeliefert werden.
	</p>
</section>

<section>
	<p class="note">Stand: {REVIEWED_ON}</p>
</section>
