/**
 * The site operator of v10r.dev — the one record of who runs this deployment.
 *
 * The same person is the provider under § 5 DDG (Impressum), the person responsible
 * for content under § 18 Abs. 2 MStV, the DSA Art. 11/12 contact point, and the
 * controller under GDPR Art. 4(7) (Datenschutzerklärung). Every legal page reads this
 * record, so the identity cannot drift between them.
 *
 * A plain constant, not an environment variable: § 5 DDG requires the data to be
 * "ständig verfügbar", and an unset variable must never blank the legally mandated
 * page. None of it is secret — it is published on /impressum by law.
 *
 * Forking v10r? Replace these values: you become the operator of your deployment.
 * The privacy showcase never reads this record; it renders template values.
 */
export interface SiteOperator {
	/** Legal name, as the Impressum must state it. */
	name: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
	/**
	 * Contact mailbox for the Impressum, the DSA contact point and data-protection
	 * requests. A personal mailbox: it will be harvested off the Impressum, the cost of
	 * § 5 DDG requiring it in plain text. Moving it to an own-domain alias later is a
	 * one-line change here.
	 */
	email: string;
	/** Languages the contact point answers in (DSA Art. 12(1)). */
	contactLanguages: string;
}

export const siteOperator: SiteOperator = {
	name: 'Stanislaw Kirpicnikow',
	street: 'Menninghauser Str. 29',
	postalCode: '42859',
	city: 'Remscheid',
	country: 'Deutschland',
	email: 'stas-k@gmx.de',
	contactLanguages: 'Deutsch, Englisch',
};
