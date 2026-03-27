# Object Storage Security

Security patterns for file uploads and storage.

## Contents

- [Path Traversal Prevention](#path-traversal-prevention) - Never use raw user input
- [Content-Type Validation](#content-type-validation) - Magic bytes validation
- [Image Re-encoding](#image-re-encoding) - Strip malicious payloads
- [CORS Configuration](#cors-configuration) - Browser direct uploads

## Path Traversal Prevention

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

## Content-Type Validation

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

## Image Re-encoding

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

## CORS Configuration

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

## Anti-Patterns

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
