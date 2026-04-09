/** Valibot schemas for preferences API endpoints. */
import * as v from 'valibot';

export const UpdatePreferencesSchema = v.pipe(
	v.object({
		theme: v.optional(v.picklist(['light', 'dark', 'system'])),
		sidebarWidth: v.optional(v.pipe(v.number(), v.integer(), v.minValue(160), v.maxValue(320))),
	}),
	v.check((obj) => obj.theme !== undefined || obj.sidebarWidth !== undefined, 'At least one field is required'),
);
