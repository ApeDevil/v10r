import * as v from 'valibot';

/**
 * A quiet-hours boundary: `HH:MM` or null (= disabled — there is no separate
 * enabled flag). The column is bare `text` with no CHECK constraint, so this is
 * the only thing standing between a crafted POST and a garbage window; the
 * runtime predicate fails closed on top of it. `<input type="time">` submits
 * `''` when cleared, which normalizes to null rather than failing validation.
 */
const quietTime = v.pipe(
	v.nullable(v.union([v.literal(''), v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/))])),
	v.transform((val) => (val === '' ? null : val)),
);

export const notificationSettingsSchema = v.object({
	emailMention: v.optional(v.boolean(), false),
	emailComment: v.optional(v.boolean(), false),
	emailSystem: v.optional(v.boolean(), false),
	emailSuccess: v.optional(v.boolean(), false),
	emailSecurity: v.optional(v.boolean(), false),
	emailFollow: v.optional(v.boolean(), false),
	telegramMention: v.optional(v.boolean(), false),
	telegramComment: v.optional(v.boolean(), false),
	telegramSystem: v.optional(v.boolean(), false),
	telegramSecurity: v.optional(v.boolean(), false),
	discordMention: v.optional(v.boolean(), false),
	discordComment: v.optional(v.boolean(), false),
	discordSystem: v.optional(v.boolean(), false),
	discordSecurity: v.optional(v.boolean(), false),
	pushMention: v.optional(v.boolean(), false),
	pushComment: v.optional(v.boolean(), false),
	pushSystem: v.optional(v.boolean(), false),
	pushSecurity: v.optional(v.boolean(), false),
	digestFrequency: v.optional(v.picklist(['instant', 'daily', 'weekly', 'never']), 'instant'),
	quietStart: v.optional(quietTime, null),
	quietEnd: v.optional(quietTime, null),
});

export type NotificationSettingsInput = v.InferInput<typeof notificationSettingsSchema>;
