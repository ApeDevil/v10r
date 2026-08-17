import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { StoreError } from './errors';
import { BUCKET, s3 } from './index';

const AVATAR_PREFIX = 'avatars/';

/**
 * Allowed types, and the extension each one gets.
 *
 * The extension is derived from the validated MIME type, never from the
 * uploaded filename. `file.name.split('.').pop()` is caller-controlled and
 * unbounded — it can carry slashes, so a filename like `a.png/../../evil` used
 * to compose an object key outside the shape this namespace is supposed to
 * have, and that key then became a URL stored on the user record.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
};
const ALLOWED_IMAGE_TYPES = new Set(Object.keys(EXTENSION_BY_TYPE));
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Ensure a key is a well-formed avatar key.
 *
 * Called before `requireS3()`, never after — guarding second would make the
 * check unreachable wherever R2 is unconfigured, letting a config value decide
 * whether a security control runs. See `store/showcase/guards.ts`.
 */
export function assertAvatarKey(key: string): void {
	if (!key.startsWith(AVATAR_PREFIX)) {
		throw new StoreError('forbidden', `Key must start with "${AVATAR_PREFIX}": ${key}`);
	}
	// One flat segment under the prefix, ending in an extension we actually produce.
	// The prefix check alone would accept `avatars/../blog/x`, and the extension must
	// come from here, never from the uploaded filename.
	if (!/^avatars\/[^/]+\.(png|jpg|gif|webp)$/.test(key) || key.includes('..')) {
		throw new StoreError('forbidden', `Malformed avatar key: ${key}`);
	}
}

function requireS3() {
	if (!s3) throw new StoreError('credentials', 'R2 storage is not configured');
	return s3;
}

export type AvatarValidationError = 'no_file' | 'invalid_type' | 'too_large' | 'storage_unavailable';

/** Validate an avatar file before upload. Returns null if valid. */
export function validateAvatar(file: File | null): AvatarValidationError | null {
	if (!s3) return 'storage_unavailable';
	if (!file || file.size === 0) return 'no_file';
	if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'invalid_type';
	if (file.size > MAX_AVATAR_SIZE) return 'too_large';
	return null;
}

/** User-facing error messages for avatar validation failures. */
export const AVATAR_ERROR_MESSAGES: Record<AvatarValidationError, string> = {
	no_file: 'No file selected',
	invalid_type: 'Only PNG, JPEG, GIF, and WebP images are allowed',
	too_large: 'File must be under 2 MB',
	storage_unavailable: 'Storage not configured',
};

/** Upload an avatar image to R2 and update the user record. Returns the new avatar URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
	const ext = EXTENSION_BY_TYPE[file.type];
	if (!ext) throw new StoreError('forbidden', `Unsupported avatar type: ${file.type}`);
	const key = `${AVATAR_PREFIX}${userId}.${ext}`;
	assertAvatarKey(key);
	const client = requireS3();

	await client.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: Buffer.from(await file.arrayBuffer()),
			ContentType: file.type,
		}),
	);

	const avatarUrl = `/${key}`;
	await db.update(user).set({ image: avatarUrl, updatedAt: new Date() }).where(eq(user.id, userId));
	return avatarUrl;
}

/** Remove the user's avatar from R2 and clear the image field. */
export async function removeAvatar(userId: string, currentImage: string | null): Promise<void> {
	if (s3 && currentImage?.startsWith(`/${AVATAR_PREFIX}`)) {
		const key = currentImage.slice(1);
		// The stored value should only ever be one we wrote, but it is a DB column
		// and this is a delete — re-derive nothing, verify instead.
		assertAvatarKey(key);
		await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
	}
	await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, userId));
}
