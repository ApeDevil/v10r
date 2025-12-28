# Implementation Steps

Concrete steps to go from zero code to functional app-shell deployed on Vercel and Koyeb.

---

## Phase 0: Scaffold

### Create Project

```bash
# Create SvelteKit project with Bun
bun create svelte@latest . --template skeleton --types ts

# Install core dependencies
bun add drizzle-orm @neondatabase/serverless better-auth valibot sveltekit-superforms svelte-i18n
bun add -D drizzle-kit unocss @unocss/preset-uno @unocss/preset-icons @iconify-json/lucide
bun add -D @sveltejs/adapter-vercel svelte-adapter-bun
bun add -D @biomejs/biome
```

### Configuration Files

| File | Purpose |
|------|---------|
| `svelte.config.js` | Dynamic adapter selection (Vercel vs Bun) |
| `vite.config.ts` | UnoCSS plugin integration |
| `uno.config.ts` | Presets, theme, safelist |
| `biome.json` | Linting and formatting rules |
| `.env.example` | Required environment variables |
| `tsconfig.json` | Path aliases (`$lib`, etc.) |

### Package Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "build:bun": "DEPLOY_TARGET=bun vite build",
    "preview": "vite preview",
    "preview:bun": "DEPLOY_TARGET=bun bun run build && bun ./build/index.js",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "biome check .",
    "format": "biome format --write .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Phase 1: Container Setup

### Files to Create

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Bun build for Koyeb |
| `.dockerignore` | Exclude node_modules, .svelte-kit, etc. |
| `compose.yaml` | Local dev with Podman (app + optional services) |

### Dockerfile (Multi-Stage)

```dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV DEPLOY_TARGET=bun
RUN bun run build

FROM base AS prod-deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM base AS runner
USER bun
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/build ./build
COPY --from=builder --chown=bun:bun /app/package.json ./
ENV NODE_ENV=production
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=x-forwarded-host
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "./build/index.js"]
```

### Health Endpoint

```typescript
// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';

export async function GET() {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
```

### Verify Container

```bash
podman build -t velociraptor .
podman run -p 3000:3000 velociraptor
# Open http://localhost:3000/api/health
```

---

## Phase 2: App Shell Foundation

### Component Structure

```
src/lib/components/
├── shell/
│   ├── AppShell.svelte       # Main wrapper
│   ├── Sidebar.svelte        # Container (rail/drawer logic)
│   ├── SidebarRail.svelte    # Desktop collapsed state
│   ├── SidebarDrawer.svelte  # Mobile drawer
│   ├── SidebarNav.svelte     # Navigation container
│   ├── NavItem.svelte        # Individual nav link
│   ├── Footer.svelte         # Page footer
│   └── index.ts              # Barrel export
└── ui/
    └── (Bits UI wrappers later)
```

### AppShell Component

```svelte
<!-- src/lib/components/shell/AppShell.svelte -->
<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import Footer from './Footer.svelte';

  let { children } = $props();
</script>

<a href="#main-content" class="skip-link">Skip to main content</a>

<div class="app-shell">
  <Sidebar />
  <main id="main-content" class="main-content" tabindex="-1">
    {@render children()}
    <Footer />
  </main>
</div>
```

### Root Layout

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { AppShell } from '$lib/components/shell';
  import '@unocss/reset/tailwind.css';
  import 'uno.css';

  let { children } = $props();
</script>

<AppShell>
  {@render children()}
</AppShell>
```

### Responsive Behavior

| Breakpoint | Sidebar Behavior |
|------------|------------------|
| Mobile (`< 768px`) | FAB + right drawer |
| Tablet (`768-1024px`) | Left rail, click to expand |
| Desktop (`> 1024px`) | Left rail, hover to expand |

---

## Phase 3: Theme System

### Theme Store

```typescript
// src/lib/stores/theme.svelte.ts
import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

function createThemeStore() {
  let theme = $state<Theme>('system');

  function setTheme(newTheme: Theme) {
    theme = newTheme;
    if (browser) {
      document.cookie = `theme=${newTheme};path=/;max-age=31536000`;
      applyTheme(newTheme);
    }
  }

  function applyTheme(t: Theme) {
    const isDark = t === 'dark' ||
      (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  return {
    get current() { return theme; },
    set: setTheme,
    toggle() {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };
}

export const themeStore = createThemeStore();
```

### No-Flash Script

```html
<!-- src/app.html -->
<head>
  <script>
    (function() {
      const theme = document.cookie.match(/theme=(light|dark|system)/)?.[1] || 'system';
      const isDark = theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
    })();
  </script>
</head>
```

### Server Hook (Read Theme Cookie)

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get('theme') || 'system';
  event.locals.theme = theme;

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%theme%', theme === 'dark' ? 'dark' : '')
  });
};
```

---

## Phase 4: i18n Setup

### Configuration

```typescript
// src/lib/i18n/index.ts
import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

register('en', () => import('./en/common.json'));
register('de', () => import('./de/common.json'));

init({
  fallbackLocale: 'en',
  initialLocale: browser ? window.navigator.language.split('-')[0] : 'en',
});
```

### Translation Files

```json
// src/lib/i18n/en/common.json
{
  "nav": {
    "home": "Home",
    "showcase": "Showcase",
    "docs": "Docs"
  },
  "home": {
    "title": "Velociraptor",
    "description": "Full-stack template for speed and simplicity."
  },
  "theme": {
    "light": "Light",
    "dark": "Dark",
    "system": "System"
  }
}
```

### Language Switcher

```svelte
<!-- src/lib/components/LanguageSwitcher.svelte -->
<script lang="ts">
  import { locale, locales } from 'svelte-i18n';
</script>

<select bind:value={$locale}>
  {#each $locales as loc}
    <option value={loc}>{loc.toUpperCase()}</option>
  {/each}
</select>
```

### Layout Integration

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '$lib/i18n';
  import { isLoading } from 'svelte-i18n';
</script>

{#if $isLoading}
  <p>Loading...</p>
{:else}
  <AppShell>{@render children()}</AppShell>
{/if}
```

---

## Phase 5: Landing Page

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { t } from 'svelte-i18n';
  import { themeStore } from '$lib/stores/theme.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>

<div class="container mx-auto px-4 py-16">
  <h1 class="text-4xl font-bold mb-4">{$t('home.title')}</h1>
  <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
    {$t('home.description')}
  </p>

  <div class="flex gap-4 items-center">
    <button
      onclick={() => themeStore.toggle()}
      class="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800"
    >
      {themeStore.current === 'dark' ? '☀️' : '🌙'}
    </button>

    <LanguageSwitcher />
  </div>
</div>
```

---

## Phase 6: Deployment

### Vercel (Node.js) - Stable

1. Connect repository to Vercel dashboard
2. Framework preset: SvelteKit (auto-detected)
3. Set environment variables in dashboard
4. Push to main branch

```json
// vercel.json
{
  "framework": "sveltekit",
  "regions": ["iad1"]
}
```

### Vercel (Bun) - Experimental

Same as above, plus:

```json
// vercel.json
{
  "framework": "sveltekit",
  "bunVersion": "1.x",
  "regions": ["iad1"]
}
```

### Koyeb (Bun Container)

1. Build locally: `podman build -t velociraptor .`
2. Create app in Koyeb dashboard
3. Select GitHub repository
4. Builder: Dockerfile
5. Instance: Nano (free tier)
6. Set environment variables
7. Port: 3000

---

## Task Checklist

| # | Task | Status |
|---|------|--------|
| 1 | `bun create svelte` (skeleton) | |
| 2 | Install dependencies | |
| 3 | Configure biome, uno, vite, svelte.config | |
| 4 | Create Dockerfile + .dockerignore | |
| 5 | Create compose.yaml | |
| 6 | Create health endpoint | |
| 7 | Verify: `podman build && run` | |
| 8 | Create shell components (AppShell, Sidebar stub) | |
| 9 | Create theme store + toggle | |
| 10 | Add no-flash inline script | |
| 11 | Configure svelte-i18n | |
| 12 | Create translation files (en, de) | |
| 13 | Create language switcher | |
| 14 | Build landing page | |
| 15 | Deploy to Vercel (Node.js) | |
| 16 | Deploy to Koyeb | |
| 17 | Test Vercel Bun mode (optional) | |

---

## Gotchas

| Area | Issue | Solution |
|------|-------|----------|
| Rate limiting | Better Auth built-in is broken | Use sveltekit-rate-limiter |
| Auth state | Module-level `useSession()` breaks SSR | Use `event.locals` |
| Koyeb | Free tier sleeps after inactivity | Implement loading states, optional keep-alive |
| UnoCSS | Dynamic classes not detected | Use safelist in uno.config.ts |
| Theme | Flash of wrong theme on load | Inline script in `<head>` |
| Svelte 5 | Old store syntax ($:) deprecated | Use `$state`, `$derived`, `$effect` |

---

## Related

- [ideas.md](./ideas.md) - Original implementation ideas
- [../blueprint/pages.md](../blueprint/pages.md) - Route structure
- [../blueprint/app-shell/](../blueprint/app-shell/) - Shell component specs
- [../blueprint/deployment.md](../blueprint/deployment.md) - Deployment details
