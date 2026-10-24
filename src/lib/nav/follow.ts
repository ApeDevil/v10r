/**
 * Navigate to an href the caller did not write — a menu item, a palette hit, a command.
 *
 * SvelteKit 3's `goto` rejects a same-origin URL that matches no route (a static file such as
 * `/third-party-licenses.txt`, a `+server` endpoint), where SvelteKit 2 loaded it as a document.
 * Components that take arbitrary hrefs keep that behaviour by asking the router first. External
 * URLs still go to `goto`, which refuses them: following one is the caller's decision.
 */
import { goto } from '$app/navigation';
import { match } from '$app/paths';

export async function followHref(href: string): Promise<void> {
	const url = new URL(href, window.location.href);
	if (url.origin === window.location.origin && !(await match(url))) {
		window.location.assign(url);
		return;
	}
	await goto(href);
}
