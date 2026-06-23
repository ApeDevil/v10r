# Images

The project's image strategy: server-side processing for user uploads via Sharp, delivered from Cloudflare R2.

## Strategy

| Image type | Processing | Tool |
|------------|------------|------|
| User uploads | On upload | Sharp |
| Storage | CDN delivery | Cloudflare R2 (zero egress) |

**Upload processing** (`src/lib/server/imagemeta/process.ts`):

The upload path produces a **single** sanitised WebP derivative. Sharp re-encodes the original, bakes in EXIF orientation, strips all metadata, and resizes to one max-dimension cap:

- Resize: `fit: 'inside'`, max `IMAGE_MAX_DIMENSION` (1024px), `withoutEnlargement: true`
- Encode: WebP at `quality: 82`

There are no named thumbnail/medium/large presets — one derivative per upload.

## Known limitations

- No build-time image pipeline. Static assets in the repo are served as-is; only the upload path runs Sharp.
- AVIF is not used; the upload derivative is WebP only.

## Related

- [../data/r2.md](../data/r2.md) - Storage
- [unocss.md](./unocss.md) - Responsive image classes
