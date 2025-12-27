---
name: db-files
description: Object storage patterns for Velociraptor. Use when handling file uploads, downloads, presigned URLs, or blob storage. Covers S3-compatible APIs, Cloudflare R2, multipart uploads, security patterns, and SvelteKit integration. Essential for any file handling or media storage work.
---

# Object Storage Patterns

Vendor-agnostic object storage patterns. Currently implemented with Cloudflare R2 (S3-compatible).

## Contents

- [When to Use Object Storage](#when-to-use-object-storage) - vs database BLOBs
- [Core Concepts](#core-concepts) - Keys, buckets, metadata
- [Key Naming](#key-naming) - Conventions and patterns
- [Presigned URLs](#presigned-urls) - Secure temporary access
- [Direct Upload](#direct-upload) - Browser to storage
- [Multipart Uploads](#multipart-uploads) - Large files
- [Security](#security) - Validation, path traversal, CORS
- [SvelteKit Integration](#sveltekit-integration) - Form actions, streaming
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Vendor-specific details

## When to Use Object Storage

### Size Thresholds

| File Size | Storage | Why |
|-----------|---------|-----|
| < 256 KB | Database | ACID transactions, simpler queries |
| 256 KB - 1 MB | Depends | Consider read:write ratio |
| > 1 MB | Object Storage | Scales without bloating DB |

### Trade-offs

| Factor | Database BLOBs | Object Storage |
|--------|----------------|----------------|
| Transactions | Full ACID | Eventual consistency |
| Queries | Can query metadata | Metadata separate |
| Performance | Small files | Large files, high throughput |
| Scalability | Bloats DB, slows backups | Scales independently |
| Cost | Database pricing | Cheaper for volume |

### Hybrid Architecture (Recommended)

Store **metadata in database**, **files in object storage**:

```typescript
// PostgreSQL schema - metadata only
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key').notNull(), // Reference to object storage
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});
```

## Core Concepts

### Keys (Object Paths)

Object storage uses a **flat namespace**. Slashes create logical hierarchy.

```
uploads/user123/avatar.jpg     # Looks like folder, but flat key
documents/2024/01/report.pdf   # Logical organization via prefix
```

### Buckets

Containers for objects. One bucket per environment is common:

```
my-app-dev      # Development
my-app-staging  # Staging
my-app-prod     # Production
```

### Metadata

Key-value pairs attached to objects:

```typescript
await s3.send(new PutObjectCommand({
  Bucket: 'my-bucket',
  Key: 'uploads/file.pdf',
  Body: fileBuffer,
  ContentType: 'application/pdf',
  Metadata: {
    'uploaded-by': userId,
    'original-name': fileName,
  },
}));
```

**Note:** Metadata keys are lowercased by S3 API.

## Key Naming

### Conventions

```
{resource}/{owner}/{identifier}.{ext}

# Examples
uploads/{userId}/{fileId}.pdf
avatars/{userId}/current.jpg
exports/{userId}/{timestamp}.json
documents/{orgId}/{projectId}/{fileId}.pdf
```

### Best Practices

1. **Use UUIDs, not user input** for file identifiers
2. **Prefix by owner** (userId, orgId) for access control
3. **Use lowercase** for consistency
4. **Avoid special characters** - stick to `a-z`, `0-9`, `-`, `_`, `.`, `/`
5. **Max length:** 1024 bytes (UTF-8)

### Content-Addressable Storage (CAS)

Use content hash as key for automatic deduplication:

```typescript
import crypto from 'crypto';

async function uploadWithCAS(fileBuffer: ArrayBuffer): Promise<string> {
  const hash = crypto
    .createHash('sha256')
    .update(Buffer.from(fileBuffer))
    .digest('hex');

  // Shard by first 4 chars for performance
  const key = `cas/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`;

  // Check if exists (deduplication)
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    return key; // Already exists
  } catch {
    await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: fileBuffer }));
    return key;
  }
}
```

**Benefits:** Deduplication, immutability, integrity verification.

## Presigned URLs

Temporary, time-limited URLs for secure access without exposing credentials.

### Upload URL

```typescript
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function getUploadUrl(userId: string, fileName: string, mimeType: string) {
  const fileId = crypto.randomUUID();
  const key = `uploads/${userId}/${fileId}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimeType, // REQUIRED - locks Content-Type
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
  });

  return { url, key, fileId };
}
```

### Download URL

```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';

async function getDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });
}
```

### Expiration Guidelines

| Operation | Recommended | Max |
|-----------|-------------|-----|
| Upload | 5 minutes | 7 days |
| Download (sensitive) | 1 hour | 7 days |
| Download (shareable) | 24 hours | 7 days |

### Security: Content-Type Locking

Always specify `ContentType` in upload URLs:

```typescript
// WRONG - attacker can upload HTML/JS
const command = new PutObjectCommand({
  Bucket, Key,
  // No ContentType - accepts anything!
});

// RIGHT - signature includes Content-Type
const command = new PutObjectCommand({
  Bucket, Key,
  ContentType: 'image/png', // Client MUST send this exact type
});
```

If client sends different Content-Type: `403 SignatureDoesNotMatch`.

## Direct Upload

Best practice: Generate presigned URL on server, upload from browser directly to storage.

### Server: Generate URL

```typescript
// src/routes/api/upload/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const { fileName, fileSize, mimeType } = await request.json();

  // Validate
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (fileSize > MAX_SIZE) {
    throw error(413, 'File too large');
  }

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw error(415, 'Unsupported file type');
  }

  const fileId = crypto.randomUUID();
  const key = `uploads/${locals.user.id}/${fileId}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return json({ presignedUrl, fileId, key });
};
```

### Client: Upload Directly

```svelte
<script lang="ts">
  let files: FileList;
  let uploading = false;
  let progress = 0;

  async function handleUpload() {
    const file = files[0];
    uploading = true;

    try {
      // 1. Get presigned URL from server
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!res.ok) throw new Error('Failed to get upload URL');
      const { presignedUrl, fileId } = await res.json();

      // 2. Upload directly to storage
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      // 3. Confirm upload to server (save metadata to DB)
      await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName: file.name }),
      });

    } finally {
      uploading = false;
    }
  }
</script>

<input type="file" bind:files disabled={uploading} />
<button onclick={handleUpload} disabled={!files?.length || uploading}>
  {uploading ? 'Uploading...' : 'Upload'}
</button>
```

### Benefits

- Server never handles file bytes (reduces load)
- Faster (direct to edge)
- Scales with traffic
- No serverless body size limits

## Multipart Uploads

For files > 100 MB, use multipart uploads.

### Key Specs

| Parameter | Value |
|-----------|-------|
| Part size (min) | 5 MB |
| Part size (max) | 5 GB |
| Part size (recommended) | 64 MB |
| Max parts | 10,000 |
| Max file size | 5 TB |

### Basic Pattern

```typescript
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';

async function multipartUpload(file: File, key: string) {
  const PART_SIZE = 64 * 1024 * 1024; // 64 MB
  const parts: { ETag: string; PartNumber: number }[] = [];

  // 1. Initiate
  const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));

  try {
    // 2. Upload parts
    const numParts = Math.ceil(file.size / PART_SIZE);

    for (let i = 0; i < numParts; i++) {
      const start = i * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const chunk = file.slice(start, end);

      const { ETag } = await s3.send(new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        UploadId,
        PartNumber: i + 1,
        Body: chunk,
      }));

      parts.push({ ETag: ETag!, PartNumber: i + 1 });
    }

    // 3. Complete
    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId,
      MultipartUpload: { Parts: parts },
    }));

  } catch (error) {
    // Abort on failure (cleanup incomplete parts)
    await s3.send(new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId,
    }));
    throw error;
  }
}
```

### Resumable Uploads

Store progress in localStorage for resume capability:

```typescript
interface UploadProgress {
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
  completedParts: number;
}

function saveProgress(fileId: string, progress: UploadProgress) {
  localStorage.setItem(`upload_${fileId}`, JSON.stringify(progress));
}

function loadProgress(fileId: string): UploadProgress | null {
  const stored = localStorage.getItem(`upload_${fileId}`);
  return stored ? JSON.parse(stored) : null;
}
```

## Security

### Path Traversal Prevention

Never use raw user input in keys:

```typescript
// WRONG - path traversal vulnerability
const key = `uploads/${userInput}`; // ../../../etc/passwd

// RIGHT - use generated ID, store original name in DB
const fileId = crypto.randomUUID();
const key = `uploads/${userId}/${fileId}`;
await db.insert(files).values({
  id: fileId,
  storageKey: key,
  fileName: userInput, // Original name stored safely
});
```

### Content-Type Validation

Client-side Content-Type is untrusted. Validate with magic bytes:

```typescript
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf']);

async function validateFile(buffer: ArrayBuffer): Promise<string> {
  const type = await fileTypeFromBuffer(new Uint8Array(buffer));

  if (!type || !ALLOWED_TYPES.has(type.mime)) {
    throw new Error(`Invalid file type: ${type?.mime ?? 'unknown'}`);
  }

  return type.mime;
}
```

### Image Re-encoding

Strip malicious payloads from images:

```typescript
import sharp from 'sharp';

async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
  // Re-encode strips metadata, embedded scripts, polyglot payloads
  return sharp(buffer)
    .png({ quality: 90 })
    .toBuffer();
}
```

### CORS Configuration

For browser direct uploads:

```typescript
const corsRules = [{
  AllowedOrigins: ['https://yourapp.com'], // NEVER use '*' in production
  AllowedMethods: ['PUT', 'GET'],
  AllowedHeaders: ['Content-Type', 'Content-MD5'],
  ExposeHeaders: ['ETag'],
  MaxAgeSeconds: 3600,
}];
```

## SvelteKit Integration

### Form Action Upload (Server-Side)

For small files that can pass through server:

```typescript
// +page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
  upload: async ({ request, locals }) => {
    if (!locals.user) return fail(401, { error: 'Unauthorized' });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      return fail(400, { error: 'No file provided' });
    }

    if (file.size > 5 * 1024 * 1024) {
      return fail(413, { error: 'File too large (max 5 MB)' });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = crypto.randomUUID();
    const key = `uploads/${locals.user.id}/${fileId}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    await db.insert(files).values({
      id: fileId,
      userId: locals.user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storageKey: key,
    });

    return { success: true, fileId };
  },
};
```

### Streaming Download

```typescript
// src/routes/files/[id]/+server.ts
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const file = await db.query.files.findFirst({
    where: eq(files.id, params.id),
  });

  if (!file || file.userId !== locals.user?.id) {
    throw error(404, 'File not found');
  }

  const { Body, ContentType } = await s3.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: file.storageKey,
  }));

  return new Response(Body as ReadableStream, {
    headers: {
      'Content-Type': ContentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    },
  });
};
```

### Range Requests (Video/Audio)

```typescript
export const GET: RequestHandler = async ({ request, params }) => {
  const range = request.headers.get('range');

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: file.storageKey,
    Range: range || undefined,
  });

  const { Body, ContentLength, ContentRange } = await s3.send(command);

  if (range && ContentRange) {
    return new Response(Body as ReadableStream, {
      status: 206,
      headers: {
        'Content-Range': ContentRange,
        'Content-Length': ContentLength!.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Type': file.mimeType,
      },
    });
  }

  return new Response(Body as ReadableStream, {
    headers: {
      'Content-Type': file.mimeType,
      'Accept-Ranges': 'bytes',
    },
  });
};
```

## Anti-Patterns

### Using User Input in Keys

```typescript
// WRONG - path traversal, naming collisions
const key = `uploads/${fileName}`;

// RIGHT - use generated ID
const key = `uploads/${userId}/${crypto.randomUUID()}`;
```

### Trusting Client Content-Type

```typescript
// WRONG - client can lie
await s3.send(new PutObjectCommand({
  ContentType: file.type, // Could be 'text/html' for XSS
}));

// RIGHT - validate server-side
const validatedType = await validateFileType(buffer);
await s3.send(new PutObjectCommand({
  ContentType: validatedType,
}));
```

### Long-Lived Presigned URLs

```typescript
// WRONG - URL valid for a week
const url = await getSignedUrl(client, command, { expiresIn: 604800 });

// RIGHT - short-lived for security
const url = await getSignedUrl(client, command, { expiresIn: 300 });
```

### Storing Files in Serverless /tmp

```typescript
// WRONG - ephemeral filesystem, 10 MB limit
import { writeFileSync } from 'fs';
writeFileSync('/tmp/file.pdf', buffer);

// RIGHT - stream directly to object storage
await s3.send(new PutObjectCommand({ Body: buffer }));
```

### No Cleanup for Failed Multipart

```typescript
// WRONG - incomplete parts accumulate
await s3.send(new UploadPartCommand(/* ... */));
// Error occurs, no cleanup

// RIGHT - always abort on failure
try {
  // upload parts
} catch (error) {
  await s3.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId }));
  throw error;
}
```

## References

- **references/r2.md** - Cloudflare R2 configuration, free tier, public buckets
