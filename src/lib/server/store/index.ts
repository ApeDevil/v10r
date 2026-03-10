import { S3Client } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

function createS3(): S3Client | null {
	const accountId = env.R2_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
	if (!accountId || !accessKeyId || !secretAccessKey || !env.R2_BUCKET_NAME) return null;
	return new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
	});
}

export const s3: S3Client | null = createS3();
export const BUCKET: string = env.R2_BUCKET_NAME ?? '';
