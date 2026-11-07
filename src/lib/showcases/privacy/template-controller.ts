/**
 * Template controller for the privacy showcase.
 *
 * `/showcases/privacy` is a pattern, not v10r.dev's privacy policy, so it renders
 * these placeholder values instead of a real identity. The binding policy of this
 * deployment is `/datenschutz`, which reads the site-operator record in
 * `#lib/server/legal`. Adapting the pattern means pointing the controller block at
 * your own operator record; `leak-gate.test.ts` keeps real identities out of here.
 */
export interface TemplateController {
	name: string;
	address: string;
	email: string;
	supervisoryAuthority: { name: string; url: string };
}

export const templateController: TemplateController = {
	name: 'Example Operator (your name or company)',
	address: 'Example Street 1, 12345 Example City, Country',
	email: 'privacy@example.com',
	supervisoryAuthority: {
		name: 'The data-protection authority responsible for your seat',
		url: 'https://www.edpb.europa.eu/about-edpb/about-edpb/members_en',
	},
};
