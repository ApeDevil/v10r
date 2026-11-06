/**
 * The page-wide tracker behind center engagement (rule: `pickCenteredCard`).
 *
 * One tracker serves every latent card on the page: one passive scroll listener and one
 * resize listener, measured at most once per animation frame. It runs only while
 * `CENTER_ENGAGEMENT_QUERY` matches, so a desktop never pays for it, and it stops when
 * the last card leaves.
 */
import { CENTER_ENGAGEMENT_QUERY, pickCenteredCard } from './latent-card';

type SetCentered = (centered: boolean) => void;

const cards = new Map<HTMLElement, SetCentered>();
let current: HTMLElement | null = null;
let frame = 0;
let query: MediaQueryList | null = null;

function measure() {
	frame = 0;
	const active = query?.matches ?? false;
	const entries = [...cards.keys()];
	const index = active
		? pickCenteredCard(
				entries.map((el) => el.getBoundingClientRect()),
				window.innerHeight,
			)
		: -1;
	const next = index === -1 ? null : entries[index];
	if (next === current) return;
	if (current) cards.get(current)?.(false);
	current = next;
	if (current) cards.get(current)?.(true);
}

function schedule() {
	if (frame === 0) frame = requestAnimationFrame(measure);
}

function start() {
	query = window.matchMedia(CENTER_ENGAGEMENT_QUERY);
	query.addEventListener('change', schedule);
	window.addEventListener('scroll', schedule, { passive: true, capture: true });
	window.addEventListener('resize', schedule, { passive: true });
}

function stop() {
	query?.removeEventListener('change', schedule);
	window.removeEventListener('scroll', schedule, { capture: true });
	window.removeEventListener('resize', schedule);
	if (frame !== 0) cancelAnimationFrame(frame);
	frame = 0;
	query = null;
	current = null;
}

/** Track `card`; `setCentered` hears when it gains or loses the center. Returns the release. */
export function trackCenterEngagement(card: HTMLElement, setCentered: SetCentered): () => void {
	if (cards.size === 0) start();
	cards.set(card, setCentered);
	schedule();
	return () => {
		if (current === card) current = null;
		cards.delete(card);
		setCentered(false);
		if (cards.size === 0) stop();
		else schedule();
	};
}
