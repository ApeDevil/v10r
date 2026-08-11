/**
 * Human-confirmation ping — the corroboration signal the counting model rests
 * on. A session only counts as a "confirmed visitor" once client-side
 * JavaScript has demonstrably run; everything else stays in the unconfirmed
 * bucket. This module is that demonstration: one constant-payload POST per
 * document load.
 *
 * CONSENT-FREE BY CONSTRUCTION, deliberately. The payload is identical for
 * every visitor (the server-issued token — an HMAC the client cannot read
 * anything out of), and this module reads nothing from the device: no cookie,
 * no storage, no navigator probing, no consent state. That is the shape German
 * guidance blesses for consent-free counting (DSK OH Digitale Dienste ¶88: a
 * first-party counting pixel that captures no further user data), and it is
 * also why this module must never grow a payload field — anything added here
 * re-opens the TDDDG §25 question.
 *
 * Not consulting consent state is also what makes the timing correct: at
 * mount, `consent.tier` is still null (the cookie read is itself an effect),
 * so a consent-gated ping would race resolution and silently drop.
 *
 * ## Why it fires EARLY, not at unload
 *
 * Unload-time delivery loses ~9% of beacons even on the good
 * pagehide+visibilitychange pair (52M-pageview benchmark), far more on
 * mobile/Safari — and under the corroboration model every lost ping files a
 * real person as a presumed crawler. So this fires at min(1.5s after init,
 * first interaction) while the page is demonstrably alive.
 */

import { browser } from '$app/environment';
import { beacon } from './transport';

const ENDPOINT = '/api/analytics/journey/confirm';
const DELAY_MS = 1500;

let initialized = false;
let token: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function send(): void {
	if (timer === undefined) return; // already sent (or never armed)
	clearTimeout(timer);
	timer = undefined;
	removeEventListener('pointerdown', send);
	removeEventListener('keydown', send);
	if (token) beacon(ENDPOINT, { token });
}

/**
 * Arm the one-shot ping. Idempotent — the layout effect that calls this can
 * re-run. `confirmToken` comes from the root layout load (one token per
 * document load, TTL-bound and bound to this connection's visitor hash, so a
 * farmed token cannot confirm sessions from elsewhere).
 */
export function initConfirmPing(confirmToken: string | null): void {
	if (!browser || initialized) return;
	initialized = true;
	token = confirmToken;
	if (!token) return;

	timer = setTimeout(send, DELAY_MS);
	addEventListener('pointerdown', send);
	addEventListener('keydown', send);
}

/**
 * Re-send after a bfcache restore (`pageshow` with `persisted`) — renewed
 * presence, possibly under a NEW cookieless daily session if the restore
 * crossed UTC midnight. Best-effort: past the token's TTL the server silently
 * drops it, which is correct — the original session was confirmed already.
 */
export function refireConfirm(): void {
	if (!browser || !token) return;
	beacon(ENDPOINT, { token });
}
