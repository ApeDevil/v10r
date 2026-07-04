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

**v10r's verdict (2026 task force — see [blueprint/pwa.md](../../blueprint/pwa.md)):** pure PWA, **Capacitor rejected** for this stack — the static-bundle variant forces an SSR→SPA rewrite (kills cookies, CSRF, form actions, passkey rpID, Google OAuth via the webview ban) and the remote-URL variant is maintainer-discouraged with documented SW-update wedges. If Play Store presence is ever wanted, **TWA** wraps the existing PWA unchanged (but carries a ~annual target-SDK re-bump obligation). On iOS the installed PWA *is* the app.

### SvelteKit Implementation Options

| Option | When to use |
|--------|-------------|
| **@vite-pwa/sveltekit** | Want zero-config Workbox integration |
| **Built-in service worker** | Want full control, minimal deps |

**@vite-pwa/sveltekit**:
- Latest: v1.1.0 (Nov 2025); maintained but low-velocity
- Zero-config value evaporates for SSR apps (`generateSW` precaches a build glob; SSR routes aren't in it → you end up in `injectManifest` writing a custom SW anyway)
- Known unfixed issue: infinite reload loop on SvelteKit error pages (#65)

**SvelteKit built-in — what v10r uses** (`src/service-worker.ts`, policy in `$lib/pwa/sw-policy.ts`):
- `$service-worker` module provides `build`, `files`, `prerendered`, `version`
- Readable, zero-dep, unit-testable caching policy — the SW file is itself the showcase
- Accepted cost: `version` is app-global, so every deploy invalidates the whole precache (no per-file revisioning exists for SSR); the re-download is background

**Installability no longer requires a service worker at all:** Chrome dropped the SW requirement (Lighthouse 11 removed the PWA category) — a valid manifest alone is installable. iOS 26's share sheet defaults the "Open as Web App" toggle to on.

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

**Declarative Web Push** (Safari/iOS 18.4+, March 2025; absorbed into the W3C Push API Working Draft Dec 2025): a standardized JSON payload the OS renders with **no service worker code** — the SW becomes an optional transformer, and browsers that don't understand the format (Chrome/Android today) deliver the same payload as a classic `push` event. v10r sends the declarative JSON as its single payload shape (see [blueprint/pwa.md](../../blueprint/pwa.md)); field evidence is still thin, so verify on-device rather than assuming interop.

## Known limitations

### iOS Safari (Critical)

| Limitation | Impact |
|------------|--------|
| **No install prompt** | Manual Share → Add to Home Screen (iOS 26 defaults the "Open as Web App" toggle on, softening the friction; still no `beforeinstallprompt`) |
| **50MB cache limit** | Cache API strictly limited |
| **7-day storage eviction** | Applies to Safari *tabs* without recent interaction — **installed home-screen apps have their own usage counter and are exempt** (WebKit's own storage-policy statement); the old "2-week eviction kills installed PWAs" claim is outdated |
| **No background sync** | Can't sync data when app closed |
| **Cross-domain OAuth is fragile** | Redirect flows can complete in a Safari tab instead of the standalone window; magic-link emails open in Safari's separate cookie jar — prefer in-app OTP/passkeys in standalone (see [blueprint/pwa.md](../../blueprint/pwa.md)) |
| **Scope restrictions** | URLs outside manifest scope drop to Safari |

**EU/DMA note:** Apple's Feb 2024 removal of Home Screen web apps in the EU was reversed in March 2024; PWA support has held since (claims that EU PWAs still lack standalone/push are stale SEO content).

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

- [notifications](../notifications/README.md) - Push notification providers (Novu, FCM)
- [../ops/caching.md](../ops/caching.md) - Caching strategy
- [../core/sveltekit.md](../core/sveltekit.md) - Service worker support
- [../vendors.md](../vendors.md) - Hosting providers
