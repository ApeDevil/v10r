# 3D Security

Security considerations for handling user-uploaded 3D models.

## Threat Model

| Threat | Vector | Impact | Mitigation |
|--------|--------|--------|------------|
| Malicious File Upload | Disguised executable | Code execution | Magic byte + chunk validation |
| XSS via Metadata | Embedded scripts in glTF JSON | Session hijack | Recursive DOMPurify sanitization |
| GPU DoS | Polygon bomb | Browser crash | Pre-parse complexity limits |
| Resource Exhaustion | Massive textures/animations | Memory exhaustion | Animation + texture limits |
| WebGL Fingerprinting | Debug renderer info | Privacy leak | Extension blocking |
| SSRF via External URIs | External texture/buffer refs | Internal network access | Scheme allowlist + URL normalization |
| Path Traversal | Relative URIs in glTF | File disclosure | Encoded traversal detection |

---

## File Validation

### Magic Byte + Chunk Validation

**NEVER trust MIME types.** Validate magic bytes AND chunk structure.

```typescript
// $lib/server/3d/validation.ts

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// GLB magic bytes: "glTF" (0x67 0x6C 0x54 0x46)
const GLB_MAGIC = new Uint8Array([0x67, 0x6c, 0x54, 0x46]);

// GLB chunk types (little-endian)
const JSON_CHUNK_TYPE = 0x4E4F534A; // "JSON"
const BIN_CHUNK_TYPE = 0x004E4942;  // "BIN\0"

export async function validateModelFile(buffer: ArrayBuffer): Promise<ValidationResult> {
  if (buffer.byteLength < 20) {
    return { valid: false, error: 'File too small to be valid GLB' };
  }

  const header = new Uint8Array(buffer.slice(0, 12));
  const dataView = new DataView(buffer);

  // Check magic bytes
  const hasGLBMagic = GLB_MAGIC.every((byte, i) => header[i] === byte);
  if (!hasGLBMagic) {
    return { valid: false, error: 'Invalid file format: not a GLB file' };
  }

  // Check version (bytes 4-7, little-endian uint32)
  const version = dataView.getUint32(4, true);
  if (version !== 2) {
    return { valid: false, error: `Unsupported glTF version: ${version}. Only version 2 is supported.` };
  }

  // Check declared length matches actual
  const declaredLength = dataView.getUint32(8, true);
  if (declaredLength !== buffer.byteLength) {
    return { valid: false, error: 'File length mismatch: possible truncation or corruption' };
  }

  // Validate first chunk is JSON
  const firstChunkType = dataView.getUint32(16, true);
  if (firstChunkType !== JSON_CHUNK_TYPE) {
    return { valid: false, error: 'Invalid GLB: first chunk must be JSON' };
  }

  // Validate second chunk (if present) is BIN
  const jsonChunkLength = dataView.getUint32(12, true);
  const secondChunkOffset = 20 + jsonChunkLength;
  if (buffer.byteLength > secondChunkOffset + 8) {
    const secondChunkType = dataView.getUint32(secondChunkOffset + 4, true);
    if (secondChunkType !== BIN_CHUNK_TYPE) {
      return { valid: false, error: 'Invalid GLB: second chunk must be BIN' };
    }
  }

  return { valid: true };
}
```

### Pre-Parse Complexity Validation

**CRITICAL**: Validate complexity from JSON chunk BEFORE loading with Three.js.

```typescript
// $lib/server/3d/limits.ts
import type { ComplexityLimits } from '$lib/shared/3d/types';

interface GLTFJson {
  meshes?: Array<{
    primitives?: Array<{
      attributes?: { POSITION?: number };
      indices?: number;
    }>;
  }>;
  accessors?: Array<{ count: number }>;
  textures?: Array<unknown>;
  materials?: Array<unknown>;
  nodes?: Array<unknown>;
  animations?: Array<unknown>;
  images?: Array<{ width?: number; height?: number }>;
}

export interface ComplexityValidation {
  valid: boolean;
  errors: string[];
  stats: {
    vertices: number;
    triangles: number;
    textures: number;
    materials: number;
    nodes: number;
    animations: number;
  };
}

export function validateGLTFComplexity(
  gltf: GLTFJson,
  limits: ComplexityLimits
): ComplexityValidation {
  const errors: string[] = [];

  // Count vertices and triangles from accessors
  let totalVertices = 0;
  let totalTriangles = 0;

  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      if (primitive.attributes?.POSITION !== undefined) {
        const accessor = gltf.accessors?.[primitive.attributes.POSITION];
        if (accessor) {
          totalVertices += accessor.count || 0;
        }
      }
      if (primitive.indices !== undefined) {
        const accessor = gltf.accessors?.[primitive.indices];
        if (accessor) {
          totalTriangles += (accessor.count || 0) / 3;
        }
      }
    }
  }

  const stats = {
    vertices: totalVertices,
    triangles: Math.round(totalTriangles),
    textures: gltf.textures?.length || 0,
    materials: gltf.materials?.length || 0,
    nodes: gltf.nodes?.length || 0,
    animations: gltf.animations?.length || 0,
  };

  if (totalVertices > limits.maxVertices) {
    errors.push(`Vertex count (${totalVertices}) exceeds limit (${limits.maxVertices})`);
  }

  if (totalTriangles > limits.maxTriangles) {
    errors.push(`Triangle count (${Math.round(totalTriangles)}) exceeds limit (${limits.maxTriangles})`);
  }

  if (stats.textures > limits.maxTextures) {
    errors.push(`Texture count (${stats.textures}) exceeds limit (${limits.maxTextures})`);
  }

  if (stats.materials > limits.maxMaterials) {
    errors.push(`Material count (${stats.materials}) exceeds limit (${limits.maxMaterials})`);
  }

  if (stats.nodes > limits.maxNodes) {
    errors.push(`Node count (${stats.nodes}) exceeds limit (${limits.maxNodes})`);
  }

  if (stats.animations > limits.maxAnimations) {
    errors.push(`Animation count (${stats.animations}) exceeds limit (${limits.maxAnimations})`);
  }

  // Check texture sizes (if declared in images)
  for (const image of gltf.images || []) {
    if ((image.width && image.width > limits.maxTextureSize) ||
        (image.height && image.height > limits.maxTextureSize)) {
      errors.push(`Texture exceeds maximum size (${limits.maxTextureSize}px)`);
    }
  }

  return { valid: errors.length === 0, errors, stats };
}

// Parse GLB and validate before Three.js loading
export function preValidateGLB(buffer: ArrayBuffer, limits: ComplexityLimits): ComplexityValidation {
  const dataView = new DataView(buffer);
  const jsonChunkLength = dataView.getUint32(12, true);
  const jsonChunk = new TextDecoder().decode(buffer.slice(20, 20 + jsonChunkLength));

  try {
    const gltf: GLTFJson = JSON.parse(jsonChunk);
    return validateGLTFComplexity(gltf, limits);
  } catch (parseError) {
    return {
      valid: false,
      errors: ['Failed to parse GLB JSON chunk'],
      stats: { vertices: 0, triangles: 0, textures: 0, materials: 0, nodes: 0, animations: 0 },
    };
  }
}
```

---

## XSS Prevention

### Complete Metadata Sanitization

**CRITICAL**: Sanitize `extras` recursively, don't delete them.

```typescript
// $lib/server/3d/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

const SANITIZE_OPTIONS = { ALLOWED_TAGS: [], ALLOWED_ATTR: [] };

// Recursively sanitize all string values in an object
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, SANITIZE_OPTIONS);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  // Numbers, booleans, null - pass through
  return obj;
}

export function sanitizeGLTFMetadata(gltf: Record<string, unknown>): Record<string, unknown> {
  const sanitized = JSON.parse(JSON.stringify(gltf)); // Deep clone

  // Sanitize asset info
  if (sanitized.asset && typeof sanitized.asset === 'object') {
    sanitized.asset = sanitizeObject(sanitized.asset);
  }

  // Sanitize all arrays that may contain names/extras
  const arraysToSanitize = [
    'meshes', 'nodes', 'materials', 'textures', 'images',
    'samplers', 'animations', 'cameras', 'scenes', 'skins',
    'accessors', 'buffers', 'bufferViews'
  ];

  for (const arrayName of arraysToSanitize) {
    if (Array.isArray(sanitized[arrayName])) {
      sanitized[arrayName] = sanitized[arrayName].map((item: unknown) => {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          // Sanitize name
          if (typeof obj.name === 'string') {
            obj.name = DOMPurify.sanitize(obj.name, SANITIZE_OPTIONS);
          }
          // Recursively sanitize extras (preserve structure)
          if (obj.extras) {
            obj.extras = sanitizeObject(obj.extras);
          }
          // Recursively sanitize extensions
          if (obj.extensions) {
            obj.extensions = sanitizeObject(obj.extensions);
          }
        }
        return item;
      });
    }
  }

  // Sanitize root-level extras and extensions
  if (sanitized.extras) {
    sanitized.extras = sanitizeObject(sanitized.extras);
  }
  if (sanitized.extensions) {
    sanitized.extensions = sanitizeObject(sanitized.extensions);
  }

  return sanitized;
}
```

### Client-Side Display

```svelte
<script lang="ts">
  import DOMPurify from 'dompurify';

  let { model } = $props();

  // Sanitize before display (defense in depth)
  const safeName = DOMPurify.sanitize(model.name, { ALLOWED_TAGS: [] });
  const safeDescription = DOMPurify.sanitize(model.description || '', { ALLOWED_TAGS: [] });
</script>

<h1>{safeName}</h1>
<p>{safeDescription}</p>

<!-- NEVER use @html with user content -->
```

---

## URI Validation

### Secure External Resource Blocking

**CRITICAL**: Block scheme-based attacks and encoded traversal.

```typescript
// $lib/server/3d/uris.ts

interface URIValidationResult {
  valid: boolean;
  errors: string[];
}

// Only allow these MIME types in data: URIs
const ALLOWED_DATA_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/octet-stream',
  'application/gltf-buffer'
];

export function validateGLTFURIs(gltf: Record<string, unknown>): URIValidationResult {
  const errors: string[] = [];

  // Check buffer URIs
  const buffers = gltf.buffers as Array<{ uri?: string }> | undefined;
  for (const buffer of buffers || []) {
    if (buffer.uri) {
      const result = validateURI(buffer.uri);
      if (!result.valid) {
        errors.push(`Buffer URI: ${result.error}`);
      }
    }
  }

  // Check image URIs
  const images = gltf.images as Array<{ uri?: string }> | undefined;
  for (const image of images || []) {
    if (image.uri) {
      const result = validateURI(image.uri);
      if (!result.valid) {
        errors.push(`Image URI: ${result.error}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateURI(uri: string): { valid: boolean; error?: string } {
  const normalized = uri.toLowerCase().trim();

  // Decode and check for traversal attacks
  try {
    const decoded = decodeURIComponent(uri);
    // Check both original and decoded for traversal
    if (decoded.includes('..') || decoded.includes('\\') ||
        uri.includes('..') || uri.includes('\\')) {
      return { valid: false, error: 'Path traversal detected' };
    }
  } catch {
    return { valid: false, error: 'Malformed URI encoding' };
  }

  // Check for scheme
  const colonIdx = normalized.indexOf(':');
  if (colonIdx !== -1) {
    const scheme = normalized.substring(0, colonIdx);

    // Allow data: URIs with safe MIME types only
    if (scheme === 'data') {
      const mimeMatch = normalized.match(/^data:([^;,]+)/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (!ALLOWED_DATA_MIMES.includes(mime)) {
          return { valid: false, error: `Disallowed data URI MIME type: ${mime}` };
        }
      }
      return { valid: true };
    }

    // Block ALL other schemes (http, https, file, javascript, gopher, etc.)
    return { valid: false, error: `External scheme not allowed: ${scheme}:` };
  }

  // Block protocol-relative URLs
  if (normalized.startsWith('//')) {
    return { valid: false, error: 'Protocol-relative URLs not allowed' };
  }

  // Block absolute paths
  if (normalized.startsWith('/')) {
    return { valid: false, error: 'Absolute paths not allowed' };
  }

  // Allow relative paths (already checked for traversal)
  return { valid: true };
}
```

### Client-Side Secure Loader

```typescript
// $lib/3d/engine/loader.ts

export function createSecureLoader(
  allowedOrigins: string[] = []
): GLTFLoader {
  const loader = new GLTFLoader();

  // Override the LoadingManager to validate URLs
  const manager = new THREE.LoadingManager();

  manager.setURLModifier((url: string) => {
    const parsedUrl = new URL(url, window.location.origin);

    // Allow same-origin
    if (parsedUrl.origin === window.location.origin) {
      return url;
    }

    // Allow explicitly whitelisted origins
    if (allowedOrigins.includes(parsedUrl.origin)) {
      return url;
    }

    // Allow data URIs
    if (url.startsWith('data:')) {
      return url;
    }

    // Block everything else
    console.error(`Blocked loading from disallowed origin: ${parsedUrl.origin}`);
    throw new Error(`Loading from origin ${parsedUrl.origin} is not allowed`);
  });

  loader.manager = manager;
  return loader;
}
```

---

## CSP Configuration

**CRITICAL**: Include `wasm-unsafe-eval` for Draco WASM decoder.

### SvelteKit Hooks

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const R2_ORIGIN = env.R2_PUBLIC_URL || 'https://r2.yourdomain.com';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // CSP for pages with 3D content
  if (event.url.pathname.startsWith('/showcase/3d') ||
      event.url.pathname.startsWith('/app/models')) {

    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      // Scripts: WASM for Draco decoder - NO unsafe-inline for scripts
      "script-src 'self' 'wasm-unsafe-eval'",
      // Styles: unsafe-inline required for Svelte transitions
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs (textures) + blob (generated) + R2
      `img-src 'self' data: blob: ${R2_ORIGIN}`,
      // Connect: self + R2 for model loading
      `connect-src 'self' ${R2_ORIGIN}`,
      // Workers: Draco decoder worker
      "worker-src 'self' blob:",
      // Prevent plugin-based attacks
      "object-src 'none'",
      // Prevent base tag injection
      "base-uri 'self'",
      // Restrict form submissions
      "form-action 'self'",
      // Prevent framing
      "frame-ancestors 'none'",
    ].join('; '));
  }

  return response;
};
```

### Draco Decoder Note

The Draco decoder uses WebAssembly. If `wasm-unsafe-eval` causes issues:
1. Use the JavaScript-only Draco decoder (slower)
2. Or host Draco WASM files on your own origin

---

## WebGL Fingerprinting

Block renderer info to prevent fingerprinting.

```typescript
// $lib/3d/engine/privacy.ts

export function blockDebugInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  // Block WEBGL_debug_renderer_info extension
  const originalGetExtension = gl.getExtension.bind(gl);
  gl.getExtension = (name: string) => {
    if (name === 'WEBGL_debug_renderer_info') {
      return null;
    }
    return originalGetExtension(name);
  };

  // Block getParameter for renderer info
  const originalGetParameter = gl.getParameter.bind(gl);
  gl.getParameter = (pname: number) => {
    // UNMASKED_VENDOR_WEBGL = 0x9245
    // UNMASKED_RENDERER_WEBGL = 0x9246
    if (pname === 0x9245 || pname === 0x9246) {
      return 'WebGL Renderer';
    }
    return originalGetParameter(pname);
  };
}
```

---

## Rate Limiting

### Upload Endpoint with Per-User Limits

```typescript
// src/routes/api/models/upload/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RateLimiter } from 'sveltekit-rate-limiter/server';

const uploadLimiter = new RateLimiter({
  IP: [5, 'h'],        // 5 uploads per hour per IP
  IPUA: [3, '15m'],    // 3 uploads per 15 min per IP+UA
  rates: {
    // Per-user rate limiting (highest priority)
    userId: async (event) => {
      const userId = event.locals.user?.id;
      if (!userId) return null;
      return { hash: userId, rate: [20, 'h'] }; // 20 models per hour per user
    },
  },
});

export const POST: RequestHandler = async (event) => {
  // Auth check first
  if (!event.locals.user) {
    error(401, 'Authentication required');
  }

  // Rate limit check
  if (await uploadLimiter.isLimited(event)) {
    error(429, {
      message: 'Upload rate limit exceeded. Please try again later.',
    });
  }

  // ... upload logic
};
```

### Signed URLs for Model Access

```typescript
// $lib/server/3d/storage.ts
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, R2_BUCKET } from '$lib/server/storage/r2';

export async function getModelUrl(storageKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
  });

  // URL valid for 1 hour
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
```

---

## Checklist

### Server-Side Validation
- [ ] Magic byte validation (not MIME type)
- [ ] GLB chunk type validation (JSON first, BIN second)
- [ ] glTF version check (must be 2)
- [ ] File size limit (10MB default)
- [ ] Pre-parse complexity limits (vertices, triangles, animations)
- [ ] URI validation (scheme allowlist, traversal detection)
- [ ] Recursive metadata sanitization (DOMPurify)

### Client-Side Protection
- [ ] Origin validation via LoadingManager
- [ ] Pre-fetch complexity validation before Three.js loading
- [ ] WebGL fingerprinting protection
- [ ] Error boundaries for rendering failures

### Infrastructure
- [ ] CSP headers with `wasm-unsafe-eval` for 3D routes
- [ ] Rate limiting on upload endpoints (IP + user)
- [ ] Signed URLs for model access (1 hour expiry)
- [ ] R2 bucket not publicly listable

### Monitoring
- [ ] Log failed validation attempts (file, complexity, URI)
- [ ] Alert on repeated rate limit hits
- [ ] Track upload patterns per user
- [ ] Monitor WebGL context creation failures
