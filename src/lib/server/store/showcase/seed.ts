import {
	ListObjectsV2Command,
	DeleteObjectsCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3';
import { s3, BUCKET } from '../index';

const SHOWCASE_PREFIX = 'showcase/';

// Minimal 1x1 red PNG (67 bytes)
const PIXEL_PNG = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
	0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
	0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
	0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const GRADIENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g)" />
</svg>`;

/** Generate 1 MB of repeating pattern data for range-request demos. */
function generatePaddedBinary(sizeBytes: number): Uint8Array {
	const data = new Uint8Array(sizeBytes);
	for (let i = 0; i < sizeBytes; i++) {
		data[i] = i % 256;
	}
	return data;
}

interface SeedObject {
	key: string;
	body: string | Uint8Array;
	contentType: string;
	metadata?: Record<string, string>;
	cacheControl?: string;
	contentEncoding?: string;
}

const SEED_OBJECTS: SeedObject[] = [
	{
		key: 'showcase/text/hello.txt',
		body: 'Hello from Cloudflare R2! This is a plain text file stored in object storage.',
		contentType: 'text/plain',
	},
	{
		key: 'showcase/text/readme.md',
		body: `# R2 Showcase\n\nThis Markdown file is stored in Cloudflare R2.\n\n## Features\n\n- Presigned URLs for secure access\n- Byte-range requests for partial reads\n- Custom metadata on every object\n`,
		contentType: 'text/markdown',
	},
	{
		key: 'showcase/text/data.csv',
		body: `name,type,size\nhello.txt,text/plain,78\nreadme.md,text/markdown,204\ndata.csv,text/csv,self-referential\n`,
		contentType: 'text/csv',
	},
	{
		key: 'showcase/json/config.json',
		body: JSON.stringify(
			{
				version: '1.0.0',
				storage: { provider: 'cloudflare-r2', region: 'auto' },
				limits: { maxUploadSize: '2MB', allowedTypes: ['image/*', 'application/pdf'] },
			},
			null,
			2,
		),
		contentType: 'application/json',
	},
	{
		key: 'showcase/json/package.json',
		body: JSON.stringify(
			{
				name: 'r2-showcase-sample',
				version: '0.1.0',
				description: 'Sample package.json stored as an R2 object',
				dependencies: { '@aws-sdk/client-s3': '^3.700.0' },
			},
			null,
			2,
		),
		contentType: 'application/json',
	},
	{
		key: 'showcase/binary/pixel.png',
		body: PIXEL_PNG,
		contentType: 'image/png',
	},
	{
		key: 'showcase/binary/gradient.svg',
		body: GRADIENT_SVG,
		contentType: 'image/svg+xml',
	},
	{
		key: 'showcase/metadata/tagged.txt',
		body: 'This file has custom x-amz-meta-* headers attached.',
		contentType: 'text/plain',
		metadata: {
			'showcase-category': 'metadata-demo',
			'created-by': 'velociraptor-seed',
			'purpose': 'demonstrate custom metadata',
		},
	},
	{
		key: 'showcase/metadata/cached.txt',
		body: 'This file has a Cache-Control header set.',
		contentType: 'text/plain',
		cacheControl: 'public, max-age=3600, s-maxage=86400',
	},
	{
		key: 'showcase/metadata/encoded.txt',
		body: 'This file has a Content-Encoding header set (identity = no encoding).',
		contentType: 'text/plain',
		contentEncoding: 'identity',
	},
	{
		key: 'showcase/large/padded.bin',
		body: generatePaddedBinary(1024 * 1024), // 1 MB
		contentType: 'application/octet-stream',
	},
];

/** Delete all objects under showcase/ and re-upload the seed set. */
export async function reseedBucket(): Promise<{ objectCount: number }> {
	// 1. Delete all existing showcase objects
	let continuationToken: string | undefined;
	do {
		const list = await s3.send(
			new ListObjectsV2Command({
				Bucket: BUCKET,
				Prefix: SHOWCASE_PREFIX,
				ContinuationToken: continuationToken,
			}),
		);

		const keys = (list.Contents ?? [])
			.map((obj) => obj.Key!)
			.filter(Boolean);

		if (keys.length > 0) {
			await s3.send(
				new DeleteObjectsCommand({
					Bucket: BUCKET,
					Delete: { Objects: keys.map((Key) => ({ Key })) },
				}),
			);
		}

		continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
	} while (continuationToken);

	// 2. Upload seed objects
	for (const obj of SEED_OBJECTS) {
		const body = typeof obj.body === 'string' ? new TextEncoder().encode(obj.body) : obj.body;

		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: obj.key,
				Body: body,
				ContentType: obj.contentType,
				Metadata: obj.metadata,
				CacheControl: obj.cacheControl,
				ContentEncoding: obj.contentEncoding,
			}),
		);
	}

	return { objectCount: SEED_OBJECTS.length };
}
