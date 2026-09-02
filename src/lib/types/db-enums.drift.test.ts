/**
 * Keeps `db-enums.ts` attached to the columns it mirrors.
 *
 * Order is asserted too, not just membership: several of these sets are rendered as
 * ordered option lists, and a silent reordering of the pgEnum would reorder the UI.
 */
import { describe, expect, it } from 'vitest';
import { aiSurfaceEnum } from '$lib/server/db/schema/ai/conversation';
import { consentTierEnum } from '$lib/server/db/schema/analytics/events';
import { commentStatusEnum } from '$lib/server/db/schema/blog/comment';
import { postStatusEnum } from '$lib/server/db/schema/blog/post';
import { fileTypeEnum } from '$lib/server/db/schema/desk/file';
import { notificationChannelEnum } from '$lib/server/db/schema/notifications/deliveries';
import { notificationTypeEnum } from '$lib/server/db/schema/notifications/notifications';
import { dateFormatEnum, displayDensityEnum, themeEnum } from '$lib/server/db/schema/personalization/user-preferences';
import {
	AI_SURFACES,
	COMMENT_STATUSES,
	CONSENT_TIERS,
	DATE_FORMATS,
	DESK_FILE_TYPES,
	DISPLAY_DENSITIES,
	NOTIFICATION_CHANNELS,
	NOTIFICATION_TYPES,
	POST_STATUSES,
	THEMES,
} from './db-enums';

const MIRRORS: ReadonlyArray<[string, readonly string[], readonly string[]]> = [
	['blog.post_status', POST_STATUSES, postStatusEnum.enumValues],
	['blog.comment_status', COMMENT_STATUSES, commentStatusEnum.enumValues],
	['app.theme', THEMES, themeEnum.enumValues],
	['app.display_density', DISPLAY_DENSITIES, displayDensityEnum.enumValues],
	['app.date_format', DATE_FORMATS, dateFormatEnum.enumValues],
	['ai.ai_surface', AI_SURFACES, aiSurfaceEnum.enumValues],
	['notifications.notification_channel', NOTIFICATION_CHANNELS, notificationChannelEnum.enumValues],
	['notifications.notification_type', NOTIFICATION_TYPES, notificationTypeEnum.enumValues],
	['analytics.consent_tier', CONSENT_TIERS, consentTierEnum.enumValues],
	['desk.file_type', DESK_FILE_TYPES, fileTypeEnum.enumValues],
];

describe('client mirrors of database enums', () => {
	for (const [column, mirror, enumValues] of MIRRORS) {
		it(`${column} matches its mirror, order included`, () => {
			expect([...mirror]).toEqual([...enumValues]);
		});
	}
});
