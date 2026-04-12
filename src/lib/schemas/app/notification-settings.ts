import * as v from 'valibot';

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
	digestFrequency: v.optional(v.picklist(['instant', 'daily', 'weekly', 'never']), 'instant'),
	quietStart: v.optional(v.nullable(v.string()), null),
	quietEnd: v.optional(v.nullable(v.string()), null),
});

export type NotificationSettingsInput = v.InferInput<typeof notificationSettingsSchema>;
