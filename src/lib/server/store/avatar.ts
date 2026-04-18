import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { BUCKET, s3 } from '$lib/server/store';

const AVATAR_PREFIX = 'avatars/';
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

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
	const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'bin';
	const key = `${AVATAR_PREFIX}${userId}.${ext}`;

	await s3?.send(
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
		await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
	}
	await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, userId));
}
