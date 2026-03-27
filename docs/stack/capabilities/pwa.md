# Progressive Web App (PWA)

## What is it?

A set of web capabilities that make your app installable, offline-capable, and native-like. Not a library—a pattern using manifest.json, service workers, and HTTPS.

| Capability | What it means |
|------------|---------------|
| **Installable** | "Add to Home Screen" on mobile/desktop |
| **Offline** | Works without network (cached assets) |
| **Push** | Native-style notifications |
| **App-like** | Full screen, splash screen, no browser chrome |

## What is it for?

- Mobile-first apps needing native-like experience
- Offline-required apps (field workers, travel, poor connectivity)
- Cross-platform reach without app store overhead
- Fast deployment without app store approval delays

**Decision framework:**

| Situation | PWA Value |
|-----------|-----------|
| Content site, blog | Low (SEO more important) |
| Dashboard, admin tool | Medium (installable is nice) |
| Mobile-first app | **High** (app-like experience) |
| Offline-required | **Critical** |
| iOS-primary audience | **Reconsider** (see limitations) |

## Why was it chosen?

| Approach | Pros | Cons |
|----------|------|------|
| **PWA** | One codebase, instant updates, no app store | iOS limitations, no full native APIs |
| **Native** | Full device access, app store presence | Separate codebases, slow updates |
| **Hybrid (Capacitor)** | Best of both, one codebase | Added complexity |

**Recommendation:** Build PWA-first, wrap with Capacitor if app store presence needed.

### SvelteKit Implementation Options

| Option | When to use |
|--------|-------------|
| **@vite-pwa/sveltekit** | Want zero-config Workbox integration |
| **Built-in service worker** | Want full control, minimal deps |

**@vite-pwa/sveltekit** (recommended for most):
- Latest: v1.1.0 (Nov 2025)
- SvelteKit 2 compatible
- Zero-config with sensible defaults
- Workbox integration built-in

**SvelteKit built-in** (`src/service-worker.js`):
- `$service-worker` module provides `build`, `files`, `version`
- More control, lighter weight
- Requires manual caching logic

### Caching Strategies

| Strategy | Use for | Tradeoff |
|----------|---------|----------|
| **Cache First** | Static assets (JS, CSS, fonts, images) | Fast, may be stale |
| **Network First** | HTML pages, critical API data | Fresh, slower |
| **Stale-While-Revalidate** | User avatars, non-critical UI | Fast + background update |
| **Network Only** | Analytics, real-time feeds | No offline |
| **Cache Only** | Precached critical assets | Must precache |

**Rule of thumb:**
- Static assets (hashed) → Cache First
- HTML pages → Network First with cache fallback
- API responses → Depends on freshness requirements

### Manifest Requirements

Minimum for installability (Chromium):

```json
{
  "name": "App Name",
  "short_name": "App",
  "start_url": "/",
  "display": "standalone",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

| Field | Requirement |
|-------|-------------|
| `name` or `short_name` | Required (short_name < 12 chars) |
| `start_url` | Required |
| `display` | Required: standalone, fullscreen, minimal-ui, browser |
| `icons` | Required: 192x192 and 512x512 minimum |
| `theme_color` | Recommended |
| `background_color` | Recommended |

### Push Notifications

| Platform | Status | Requirements |
|----------|--------|--------------|
| **Chrome/Android** | Full support | Service worker + permission |
| **iOS 16.4+** | Supported | Must be installed to home screen first |
| **Firefox** | Partial | Browser mode only on Android |

**iOS push caveats:**
- No automatic install prompt (manual "Add to Home Screen")
- Permission must be user-triggered (button click)
- No background sync (notifications only when app open)

**New in 2025:** Safari 18.5 introduced Declarative Web Push—simpler, no service worker required for basic notifications.

## Known limitations

### iOS Safari (Critical)

| Limitation | Impact |
|------------|--------|
| **No install prompt** | Users must manually use Share → Add to Home Screen |
| **50MB cache limit** | Cache API strictly limited |
| **2-week eviction** | Unused PWAs lose cached data |
| **No background sync** | Can't sync data when app closed |
| **Cross-domain OAuth fails** | Auth flows break in standalone mode |
| **Scope restrictions** | URLs outside manifest scope drop to Safari |

**iOS workarounds:**
- Guide users through install with visual prompts
- Keep cache small, prioritize critical assets
- Use localStorage for critical user data
- Implement OAuth with same-domain redirect

### Browser Support Matrix

| Feature | Chrome | Safari | Firefox |
|---------|--------|--------|---------|
| Install prompt | Auto | Manual | Android only |
| Push notifications | Full | Home screen only | Partial |
| Background sync | Yes | No | No |
| File System Access | Yes | No | No |
| Periodic background sync | Yes | No | No |

### Common Pitfalls

1. **Caching /admin routes** → Security vulnerability
2. **Over-caching APIs** → Stale data in critical flows
3. **No cache versioning** → Users stuck with old data
4. **Forgetting offline fallback** → Broken experience when offline
5. **Testing only in Chrome** → Works there, breaks on iOS

### Performance Considerations

| Concern | Limit |
|---------|-------|
| iOS cache | 50MB (Cache API), 500MB (IndexedDB) |
| Chrome cache | 50MB default, up to 20GB based on disk |
| Service worker overhead | Minimal but measurable |
| Workbox bundle | ~15-20KB |

**Best practices:**
- Don't cache videos (too large, triggers eviction)
- Version caches for clean updates
- Use `skipWaiting()` with user prompt, not automatically
- Monitor: FCP, TTFB, cache hit rate

### Project Fugu APIs (Chromium-only)

New capabilities closing native gap—but limited browser support:

| API | Use case | Safari/Firefox |
|-----|----------|----------------|
| File System Access | Document editors | No |
| Web Bluetooth | IoT devices | No |
| Web USB | Hardware peripherals | No |
| Contact Picker | Access contacts | No |

**Rule:** Use progressive enhancement. Detect support, provide fallbacks.

## Related

- [notifications.md](./notifications.md) - Push notification providers (Novu, FCM)
- [../ops/caching.md](../ops/caching.md) - Caching strategy
- [../core/sveltekit.md](../core/sveltekit.md) - Service worker support
- [../vendors.md](../vendors.md) - Hosting providers
