# Images

Image optimization strategy. Build-time for static, server-side for uploads.

## Stack

| Layer | Technology | Provider | Why |
|-------|------------|----------|-----|
| Static | **@sveltejs/enhanced-img** | Build-time | WebP/AVIF, responsive srcset |
| Uploads | **Sharp** | Server-side | Process on upload, multiple sizes |
| Storage | **S3 API** | Cloudflare R2 | Zero egress, CDN delivery |

## Strategy

| Image Type | Processing | Storage |
|------------|------------|---------|
| Static (in repo) | Build-time optimization | Bundled |
| User uploads | Server-side on upload | R2 + CDN |

## Static Images

Use `@sveltejs/enhanced-img` for images in the codebase:

- **WebP/AVIF** conversion
- **Responsive srcset** generation
- **Lazy loading** by default
- **Blur placeholder** support

Processed at build time, no runtime cost.

## User Uploads

Process once on upload with Sharp:

1. User uploads original
2. Server generates multiple sizes (thumbnail, medium, large)
3. Store all sizes in R2
4. Serve appropriate size via CDN

## Size Presets

| Preset | Dimensions | Use Case |
|--------|------------|----------|
| thumbnail | 150x150 | Lists, grids |
| medium | 800x800 | Content |
| large | 1920x1920 | Full view |
| original | As uploaded | Download |

## CDN Delivery

R2 includes CDN. Images served from edge locations automatically.

- Zero egress fees
- Global distribution
- Cache headers for browser caching

## Related

- [../data/r2.md](../data/r2.md) - Storage
- [unocss.md](./unocss.md) - Responsive image classes
- [../../blueprint/files/](../../blueprint/files/) - Upload implementation
