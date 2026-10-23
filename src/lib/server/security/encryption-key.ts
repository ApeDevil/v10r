/**
 * The one place the app reads `ENCRYPTION_KEY` and `ENCRYPTION_KEY_PREVIOUS`.
 *
 * Everything sealed with the ring — AI provider API keys, name-check vendor secrets — is
 * only as recoverable as these values, and the database cannot protect its own key, so they
 * stay in deployment secrets and are threaded into `aes-gcm.ts` by the caller. Rotation is
 * a ring change, not a loss: the new key becomes `ENCRYPTION_KEY`, the old one moves to
 * `ENCRYPTION_KEY_PREVIOUS` (comma-separated for more than one), and the
 * `encryption-reseal` job moves every envelope onto the new key. Dropping a key from the
 * ring before that sweep finished makes the secrets still sealed under it `undecryptable`
 * (`docs/blueprint/security/key-ring.md`).
 *
 * Fail at boot, not at first use: outside `dev` the ring is validated at import, so a
 * misconfigured deployment cannot look healthy until the first encrypt. Mirrors
 * `abuse/config.ts`'s `assertProductionConfig`, including the `dev` gate — an env var can
 * arrive wrong in the direction that skips the check, a build-mode constant cannot.
 */
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { type EncryptionKeyRing, parseKeyRing } from './aes-gcm';

function assertProductionConfig(): void {
	if (dev) return;
	parseKeyRing(env.ENCRYPTION_KEY, env.ENCRYPTION_KEY_PREVIOUS);
}
assertProductionConfig();

/** The validated key ring, or an `EncryptionError('invalid_key')` — never a placeholder. */
export function getEncryptionKeyRing(): EncryptionKeyRing {
	return parseKeyRing(env.ENCRYPTION_KEY, env.ENCRYPTION_KEY_PREVIOUS);
}
