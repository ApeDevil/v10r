/**
 * Form contracts for the admin provider-connection cards on `/admin/ai/models`.
 *
 * Every check carries its own message: Valibot's defaults quote the received value, and
 * a message that echoes what was typed into the key field would put the key into the
 * action's failure payload.
 */
import * as v from 'valibot';
import { AI_PROVIDER_IDS } from '$lib/types/db-enums';

const MODEL_ID_MAX = 120;
const API_KEY_MAX = 512;

const provider = v.picklist(AI_PROVIDER_IDS, 'Unknown provider.');

const modelId = v.pipe(
	v.string('Model id is required.'),
	v.trim(),
	v.minLength(1, 'Model id is required.'),
	v.maxLength(MODEL_ID_MAX, `Model id must be at most ${MODEL_ID_MAX} characters.`),
	v.regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 'Model id may contain letters, digits and . _ : / - only.'),
);

/** Empty means "keep the stored key"; the action drops it before it reaches the domain. */
const apiKey = v.optional(
	v.pipe(v.string('API key must be text.'), v.trim(), v.maxLength(API_KEY_MAX, 'API key is too long.')),
);

const version = v.pipe(
	v.number('Version is required.'),
	v.integer('Version must be a whole number.'),
	v.minValue(0, 'Version must be positive.'),
);

const enabled = v.boolean('Enabled must be on or off.');

export const providerConnectionSaveSchema = v.object({ provider, enabled, modelId, apiKey, version });
export type ProviderConnectionSaveForm = v.InferOutput<typeof providerConnectionSaveSchema>;

export const providerConnectionTestSchema = v.object({ provider, modelId, apiKey });
export type ProviderConnectionTestForm = v.InferOutput<typeof providerConnectionTestSchema>;

export const providerKeyRemoveSchema = v.object({ provider, version });

/** `'automatic'` stands in for "no default" — a Select cannot carry null. */
export const AUTOMATIC_DEFAULT = 'automatic';
const defaultChoice = v.picklist([AUTOMATIC_DEFAULT, ...AI_PROVIDER_IDS], 'Unknown provider.');

export const defaultProviderSchema = v.object({ provider: defaultChoice, expectedCurrentDefault: defaultChoice });
export type DefaultProviderForm = v.InferOutput<typeof defaultProviderSchema>;
