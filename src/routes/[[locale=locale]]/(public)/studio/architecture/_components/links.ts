/**
 * Where an evidence or pattern reference opens: app routes stay in the app, docs the in-app
 * docs site renders open there, everything else in the repository opens on GitHub.
 */
const REPO_GITHUB = 'https://github.com/ApeDevil/v10r/blob/main';
const IN_APP_DOCS = /^docs\/(blueprint|foundation|stack)\/(.+)\.md(#.*)?$/;

export function evidenceHref(ref: string): { href: string; external: boolean } {
	if (ref.startsWith('https://')) return { href: ref, external: true };
	if (ref.startsWith('/')) return { href: ref, external: false };
	const docs = IN_APP_DOCS.exec(ref);
	if (docs) {
		const page = docs[2].replace(/(^|\/)README$/, '');
		return { href: `/docs/${docs[1]}${page ? `/${page}` : ''}${docs[3] ?? ''}`, external: false };
	}
	return { href: `${REPO_GITHUB}/${ref.split('#')[0]}`, external: true };
}

export function patternHref(id: string): string {
	return `/docs/pattern-library/${id}`;
}
