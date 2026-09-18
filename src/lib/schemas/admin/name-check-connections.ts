/**
 * Form contracts for the admin source-connection cards on `/admin/name-check`.
 *
 * Every check carries its own message: Valibot's defaults quote the received value, and
 * a message that echoes what was typed into the secret field would put the secret into
 * the action's failure payload.
 */
import * as v from 'valibot';
import { NAME_SOURCE_VENDORS } from '$lib/types/db-enums';

const CLIENT_ID_MAX = 200;
const SECRET_MAX = 512;
const URL_MAX = 300;

const vendor = v.picklist(NAME_SOURCE_VENDORS, 'Unknown vendor.');

/** Empty means "keep the stored secret"; the action drops it before it reaches the domain. */
const secret = v.optional(
	v.pipe(v.string('Secret must be text.'), v.trim(), v.maxLength(SECRET_MAX, 'Secret is too long.')),
);

const clientId = v.optional(
	v.pipe(
		v.string('Client id must be text.'),
		v.trim(),
		v.maxLength(CLIENT_ID_MAX, `Client id must be at most ${CLIENT_ID_MAX} characters.`),
	),
);

/** Empty means the documented default host; anything else must be an https URL. */
const httpsUrl = v.optional(
	v.union(
		[
			v.pipe(v.string(), v.trim(), v.literal('')),
			v.pipe(
				v.string('Host must be text.'),
				v.trim(),
				v.maxLength(URL_MAX, `Host must be at most ${URL_MAX} characters.`),
				v.url('Host must be a full URL.'),
				v.startsWith('https://', 'Host must start with https://.'),
			),
		],
		'Host must be an https:// URL.',
	),
);

const version = v.pipe(
	v.number('Version is required.'),
	v.integer('Version must be a whole number.'),
	v.minValue(0, 'Version must be positive.'),
);

const enabled = v.boolean('Enabled must be on or off.');

export const nameSourceConnectionSaveSchema = v.object({
	vendor,
	enabled,
	clientId,
	secret,
	apiBase: httpsUrl,
	tokenUrl: httpsUrl,
	version,
});
export type NameSourceConnectionSaveForm = v.InferOutput<typeof nameSourceConnectionSaveSchema>;

export const nameSourceConnectionTestSchema = v.object({
	vendor,
	clientId,
	secret,
	apiBase: httpsUrl,
	tokenUrl: httpsUrl,
});
export type NameSourceConnectionTestForm = v.InferOutput<typeof nameSourceConnectionTestSchema>;

export const nameSourceSecretRemoveSchema = v.object({ vendor, version });
