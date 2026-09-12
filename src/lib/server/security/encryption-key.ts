/**
 * The one place the app reads `ENCRYPTION_KEY`.
 *
 * Everything sealed with it — Discord OAuth tokens, AI provider API keys — is only as
 * recoverable as this value, and the database cannot protect its own key, so it stays in
 * deployment secrets and is threaded into `aes-gcm.ts` by the caller. Replacing or
 * losing it invalidates every stored credential: Discord accounts must be re-linked and
 * provider keys re-entered through the admin form. Ordinary key replacement (a new API
 * key for the same provider) never touches this value.
 *
 * Fail at boot, not at first use: outside `dev` the key is validated at import, so a
 * misconfigured deployment cannot look healthy until the first encrypt. Mirrors
 * `abuse/config.ts`'s `assertProductionConfig`, including the `dev` gate — an env var can
 * arrive wrong in the direction that skips the check, a build-mode constant cannot.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { parseEncryptionKey } from './aes-gcm';

function assertProductionConfig(): void {
	if (dev) return;
	parseEncryptionKey(env.ENCRYPTION_KEY);
}
assertProductionConfig();

/** The validated hex key, or an `EncryptionError('invalid_key')` — never a placeholder. */
export function getEncryptionKey(): string {
	const keyHex = env.ENCRYPTION_KEY;
	parseEncryptionKey(keyHex);
	return keyHex as string;
}
