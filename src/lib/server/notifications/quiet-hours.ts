/**
 * Quiet hours — a pure predicate over the user's stored window.
 *
 * The window is two nullable `HH:MM` text columns on `notification_settings`
 * with no CHECK constraint, and the timezone lives on a DIFFERENT schema
 * (`app.user_preferences.timezone`, IANA, defaulting to `'UTC'`). There is no
 * `quietHoursEnabled` flag, so **null means disabled** — that is the only
 * convention the schema offers.
 *
 * FAIL CLOSED. Anything unparseable disables quiet hours rather than enabling
 * it: a garbage value must not silently swallow a user's notifications. The UI
 * writes `<input type="time">` output, but the column will accept whatever a
 * crafted POST puts there.
 *
 * Timezone math mirrors `ai/quota.ts` — plain `Intl.DateTimeFormat` +
 * `formatToParts`, no dependency. Doing this by hand rather than with an offset
 * is what makes DST correct: the formatter resolves the zone's rules for the
 * instant in question.
 */

/** Minutes since local midnight, or null if `v` is not a valid `HH:MM`. */
export function parseHhMm(v: string | null | undefined): number | null {
	if (typeof v !== 'string') return null;
	const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
	if (!m) return null;
	return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes since local midnight for `now` in `timeZone`. Falls back to UTC. */
export function minutesOfDayInTz(timeZone: string, now: Date): number {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		}).formatToParts(now);
	} catch {
		// Unknown/garbage IANA id — treat as UTC rather than throwing on the
		// notification path.
		parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'UTC',
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		}).formatToParts(now);
	}
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
	// Some implementations report hour 24 at midnight.
	return (get('hour') % 24) * 60 + get('minute');
}

/**
 * Is `now` inside the user's quiet window?
 *
 * Handles the wrap-around case, which is the COMMON one: `22:00 → 08:00` spans
 * midnight, so `start > end` means "in window if at-or-after start OR before
 * end". A naive `start <= t && t <= end` is wrong for exactly the window most
 * people configure.
 *
 * `start === end` is treated as disabled — it is ambiguous between a zero-length
 * window and a 24-hour one, and disabled is the fail-closed reading.
 */
export function isQuietNow(
	start: string | null | undefined,
	end: string | null | undefined,
	timeZone: string | null | undefined,
	now: Date = new Date(),
): boolean {
	const from = parseHhMm(start);
	const to = parseHhMm(end);
	if (from === null || to === null) return false;
	if (from === to) return false;

	const t = minutesOfDayInTz(timeZone || 'UTC', now);
	return from < to ? t >= from && t < to : t >= from || t < to;
}
