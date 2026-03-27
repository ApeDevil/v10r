# Multipart Uploads

For files > 100 MB, use multipart uploads.

## Contents

- [Key Specs](#key-specs) - Part sizes and limits
- [Basic Pattern](#basic-pattern) - Initiate, upload parts, complete
- [Resumable Uploads](#resumable-uploads) - Progress tracking with localStorage

## Key Specs

| Parameter | Value |
|-----------|-------|
| Part size (min) | 5 MB |
| Part size (max) | 5 GB |
| Part size (recommended) | 64 MB |
| Max parts | 10,000 |
| Max file size | 5 TB |

## Basic Pattern

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

## Resumable Uploads

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

## Cleanup Failed Uploads

Always abort on failure to prevent incomplete parts accumulating:

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
