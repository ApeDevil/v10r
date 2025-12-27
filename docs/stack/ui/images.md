# Images

## What is it?

Image optimization strategy combining build-time processing for static assets and server-side processing for user uploads. Focuses on modern formats (WebP, AVIF) and responsive delivery.

## What is it for?

- Reducing bandwidth consumption and page load times
- Improving Core Web Vitals (LCP target: <2.5s)
- Serving appropriate image sizes for different devices
- Converting to efficient modern formats automatically

## Why was it chosen?

| Format | Size vs JPEG | Browser Support |
|--------|--------------|-----------------|
| AVIF | 50% smaller | 93.8% |
| WebP | 25-35% smaller | 95.3% |
| JPEG | Baseline | 100% |

**Strategy:**
| Image Type | Processing | Tool |
|------------|------------|------|
| Static (in repo) | Build-time | `@sveltejs/enhanced-img` |
| User uploads | On upload | Sharp |
| Storage | CDN delivery | Cloudflare R2 |

**Key advantages:**
- Build-time optimization: no runtime cost
- Automatic WebP/AVIF conversion with JPEG fallback
- Responsive srcset generation
- Lazy loading by default
- R2 includes CDN with zero egress fees

**Size presets for uploads:**
| Preset | Dimensions | Use Case |
|--------|------------|----------|
| thumbnail | 150x150 | Lists, grids |
| medium | 800x800 | Content |
| large | 1920x1920 | Full view |

## Known limitations

**Browser support:**
- AVIF requires Safari 16+ (iOS 16+, macOS Ventura+)
- ~7-10% of browsers lack AVIF support
- Animated AVIF has playback issues in Safari
- Must implement `<picture>` fallbacks

**Tooling:**
- AVIF encoding 2-5x slower than WebP (longer builds)
- `@sveltejs/enhanced-img` only processes local images
- Cannot optimize external/dynamic images at build time
- For dynamic images: use CDN or runtime libraries

**SvelteKit-specific:**
- Enhanced-img must be placed before SvelteKit plugin in Vite config
- Build output cached in `node_modules/.cache/imagetools`
- First build is slower (cached thereafter)

## Related

- [../data/r2.md](../data/r2.md) - Storage
- [unocss.md](./unocss.md) - Responsive image classes
