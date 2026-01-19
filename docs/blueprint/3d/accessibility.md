# 3D Accessibility

WCAG 2.2 compliance and accessibility patterns for 3D visualization.

## WCAG 2.2 Requirements

| Criterion | Level | Requirement | Implementation |
|-----------|-------|-------------|----------------|
| 1.1.1 Non-text Content | A | Text alternative for 3D content | Model name + description in ARIA |
| 1.3.1 Info and Relationships | A | Structure conveyed programmatically | ARIA landmarks for controls |
| 2.1.1 Keyboard | A | All functionality via keyboard | Arrow keys, +/-, R, Escape |
| 2.1.3 Keyboard (No Exception) | AAA | No keyboard traps | Escape exits viewer focus |
| 2.4.3 Focus Order | A | Logical focus sequence | Pause → Reset → Fullscreen |
| 2.5.1 Pointer Gestures | A | Alternative to complex gestures | Keyboard equivalents |
| 4.1.3 Status Messages | AA | Programmatic status exposure | Live regions for loading/errors |

---

## Keyboard Navigation

### Key Bindings

| Key | Action | Notes |
|-----|--------|-------|
| Arrow Left/Right | Rotate horizontally | 10° increments |
| Arrow Up/Down | Rotate vertically | 10° increments |
| +/= | Zoom in | 0.5 units |
| - | Zoom out | 0.5 units |
| R | Reset camera | Return to initial view |
| Space | Toggle rotation | Pause/resume auto-rotate |
| Escape | Exit viewer | Return focus to page |
| Tab | Move to controls | Standard focus navigation |

### Implementation

```svelte
<!-- $lib/components/3d/controls/Keyboard.svelte -->
<script lang="ts">
  import { getSceneContext } from '$lib/3d/context';

  interface Props {
    rotationStep?: number;
    zoomStep?: number;
    onReset?: () => void;
    onPauseToggle?: () => void;
  }

  let {
    rotationStep = 0.1, // ~6 degrees
    zoomStep = 0.5,
    onReset,
    onPauseToggle,
  }: Props = $props();

  const { context, disposing } = getSceneContext();

  function handleKeydown(event: KeyboardEvent) {
    if (disposing || !context) return;

    const camera = context.camera;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        rotateCamera(-rotationStep, 0);
        break;
      case 'ArrowRight':
        rotateCamera(rotationStep, 0);
        break;
      case 'ArrowUp':
        rotateCamera(0, -rotationStep);
        break;
      case 'ArrowDown':
        rotateCamera(0, rotationStep);
        break;
      case '+':
      case '=':
        zoomCamera(-zoomStep);
        break;
      case '-':
        zoomCamera(zoomStep);
        break;
      case 'r':
      case 'R':
        onReset?.();
        announceStatus('Camera reset');
        break;
      case ' ':
        event.preventDefault();
        onPauseToggle?.();
        break;
      case 'Escape':
        (event.target as HTMLElement).blur();
        announceStatus('Exited 3D viewer');
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      context.requestRender();
    }
  }

  function rotateCamera(deltaX: number, deltaY: number) {
    if (!context) return;

    const camera = context.camera;
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);
    spherical.theta += deltaX;
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + deltaY));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
  }

  function zoomCamera(delta: number) {
    if (!context) return;

    const camera = context.camera;
    const direction = camera.position.clone().normalize();
    camera.position.addScaledVector(direction, delta);

    // Clamp distance
    const distance = camera.position.length();
    if (distance < 1) camera.position.setLength(1);
    if (distance > 20) camera.position.setLength(20);
  }

  // Status announcements for screen readers
  let statusMessage = $state('');
  function announceStatus(message: string) {
    statusMessage = message;
    // Clear after announcement
    setTimeout(() => statusMessage = '', 1000);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Live region for status announcements -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
>
  {statusMessage}
</div>
```

---

## ARIA Patterns

### Viewer Container

```svelte
<script lang="ts">
  let { model, loading, error } = $props();
</script>

<div
  role="region"
  aria-label="3D model: {model.name}"
  aria-describedby="model-description viewer-instructions"
  aria-busy={loading}
>
  <!-- Hidden description for screen readers -->
  <div id="model-description" class="sr-only">
    {model.description || `A 3D model named ${model.name}. ${model.polyCount?.toLocaleString() || 'Unknown'} polygons.`}
  </div>

  <!-- Instructions for interaction -->
  <div id="viewer-instructions" class="sr-only">
    Interactive 3D viewer. Use arrow keys to rotate the view, plus and minus keys to zoom,
    R to reset the camera, Space to pause rotation, and Escape to exit the viewer.
  </div>

  <!-- Loading state -->
  {#if loading}
    <div
      role="progressbar"
      aria-label="Loading 3D model"
      aria-valuenow={progress}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <!-- Visual progress bar -->
    </div>
  {/if}

  <!-- Error state -->
  {#if error}
    <div role="alert" aria-live="assertive">
      <h2>Error loading model</h2>
      <p>{error.message}</p>
    </div>
  {/if}

  <!-- Canvas -->
  <canvas
    bind:this={canvas}
    tabindex="0"
    aria-label="3D viewer canvas for {model.name}"
    onfocus={handleFocus}
    onblur={handleBlur}
  />
</div>
```

### Focus Management

```svelte
<script lang="ts">
  let canvasFocused = $state(false);

  function handleFocus() {
    canvasFocused = true;
    announceStatus(`3D viewer focused. ${getInstructions()}`);
  }

  function handleBlur() {
    canvasFocused = false;
  }

  function getInstructions(): string {
    return 'Use arrow keys to rotate, plus minus to zoom, R to reset, Escape to exit.';
  }
</script>

<canvas
  tabindex="0"
  onfocus={handleFocus}
  onblur={handleBlur}
  class:ring-2={canvasFocused}
  class:ring-primary-500={canvasFocused}
  class:ring-offset-2={canvasFocused}
/>

<!-- Announce focus state to screen readers -->
{#if canvasFocused}
  <div role="status" aria-live="assertive" class="sr-only">
    3D viewer focused. {getInstructions()}
  </div>
{/if}
```

### Controls Toolbar

```svelte
<nav aria-label="3D viewer controls" class="flex gap-2">
  <button
    onclick={togglePause}
    aria-label={paused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
    aria-pressed={paused}
  >
    {paused ? '▶ Play' : '⏸ Pause'}
  </button>

  <button
    onclick={resetCamera}
    aria-label="Reset camera to initial position"
  >
    ↺ Reset
  </button>

  <button
    onclick={toggleFullscreen}
    aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    aria-pressed={fullscreen}
  >
    {fullscreen ? '⤓ Exit' : '⤢ Fullscreen'}
  </button>
</nav>
```

---

## Reduced Motion

### Detection and Respect

```svelte
<script lang="ts">
  // System preference
  let prefersReducedMotion = $state(false);

  // User override
  let motionPreference = $state<'auto' | 'reduced' | 'none'>('auto');

  // Effective motion state
  let motionEnabled = $derived.by(() => {
    if (motionPreference === 'none') return false;
    if (motionPreference === 'reduced') return false;
    return !prefersReducedMotion;
  });

  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  });
</script>

<Canvas>
  <OrbitControls
    autoRotate={motionEnabled}
    enableDamping={motionEnabled}
  />
</Canvas>

<!-- User control to override -->
<fieldset class="mt-4">
  <legend class="font-medium">Animation preference</legend>
  <div class="flex gap-4 mt-2">
    <label class="flex items-center gap-2">
      <input
        type="radio"
        bind:group={motionPreference}
        value="auto"
        name="motion"
      />
      <span>System default</span>
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        bind:group={motionPreference}
        value="reduced"
        name="motion"
      />
      <span>Reduced</span>
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        bind:group={motionPreference}
        value="none"
        name="motion"
      />
      <span>None</span>
    </label>
  </div>
</fieldset>
```

### What to Disable

When `prefers-reduced-motion: reduce` is active:

| Feature | Reduced Motion Behavior |
|---------|------------------------|
| Auto-rotation | Disabled |
| Camera damping/easing | Disabled (instant moves) |
| Camera transitions | Instant, no animation |
| Material animations | Paused |
| Particle effects | Static or hidden |
| Loading spinners | Progress bar only |

---

## Loading States

### Accessible Progress

```svelte
<script lang="ts">
  let progress = $state(0);
  let stage = $state<'initializing' | 'downloading' | 'parsing' | 'ready'>('initializing');
</script>

{#if stage !== 'ready'}
  <div
    class="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/90"
    role="status"
    aria-live="polite"
  >
    <!-- Visual progress bar -->
    <div
      role="progressbar"
      aria-label="Loading 3D model"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuetext="{stage}: {Math.round(progress * 100)}%"
      class="w-48 h-2 bg-dark-700 rounded-full overflow-hidden"
    >
      <div
        class="h-full bg-primary-500 transition-all duration-200"
        style="width: {progress * 100}%"
      />
    </div>

    <!-- Text status -->
    <p class="mt-2 text-sm text-gray-400" aria-atomic="true">
      {#if stage === 'initializing'}
        Preparing 3D engine...
      {:else if stage === 'downloading'}
        Downloading model: {Math.round(progress * 100)}%
      {:else if stage === 'parsing'}
        Processing model...
      {/if}
    </p>
  </div>
{/if}
```

---

## Error States

### Accessible Error Display

```svelte
<script lang="ts">
  interface ErrorInfo {
    type: 'webgl' | 'network' | 'format' | 'complexity' | 'unknown';
    message: string;
    recoverable: boolean;
  }

  let { error }: { error: ErrorInfo | null } = $props();

  const errorMessages: Record<ErrorInfo['type'], { title: string; help: string }> = {
    webgl: {
      title: '3D viewing not available',
      help: 'Your browser or device does not support WebGL. Try a different browser or enable hardware acceleration.',
    },
    network: {
      title: 'Connection error',
      help: 'Could not download the 3D model. Check your internet connection and try again.',
    },
    format: {
      title: 'Invalid model format',
      help: 'This file is not a valid 3D model. Please upload a GLB file.',
    },
    complexity: {
      title: 'Model too complex',
      help: 'This model has too many polygons to display. Try a simplified version.',
    },
    unknown: {
      title: 'Error loading model',
      help: 'An unexpected error occurred. Please try again or contact support.',
    },
  };
</script>

{#if error}
  <div
    role="alert"
    aria-live="assertive"
    class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 bg-dark-900/95"
  >
    <!-- Icon (hidden from screen readers) -->
    <div class="i-mdi-alert-circle text-red-400 w-12 h-12" aria-hidden="true" />

    <!-- Error content -->
    <div class="text-center max-w-md">
      <h2 class="text-xl font-semibold text-red-400 mb-2">
        {errorMessages[error.type].title}
      </h2>
      <p class="text-gray-300 mb-2">
        {error.message}
      </p>
      <p class="text-sm text-gray-400">
        {errorMessages[error.type].help}
      </p>
    </div>

    <!-- Recovery actions -->
    <div class="flex gap-3 mt-4">
      {#if error.recoverable}
        <button
          onclick={retry}
          class="btn btn-primary"
          autofocus
        >
          Try again
        </button>
      {/if}
      <button onclick={goBack} class="btn btn-secondary">
        Go back
      </button>
      {#if error.type === 'webgl'}
        <a href="/help/webgl-support" class="btn btn-secondary">
          Learn more
        </a>
      {/if}
    </div>
  </div>
{/if}
```

---

## Mobile Accessibility

### Touch Target Sizes

WCAG 2.2 requires minimum 24×24px touch targets (44×44px recommended).

```css
/* Ensure all interactive elements meet minimum size */
.viewer-controls button,
.viewer-controls a {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
}

/* Touch action for canvas */
canvas {
  touch-action: none; /* Prevent browser gestures */
}
```

### Touch Gesture Instructions

```svelte
<div class="mt-4 text-sm text-gray-500">
  <!-- Desktop instructions -->
  <p class="hidden md:block">
    Drag to rotate • Scroll to zoom • Shift+drag to pan
  </p>

  <!-- Mobile instructions -->
  <p class="md:hidden">
    Swipe to rotate • Pinch to zoom • Two fingers to pan
  </p>
</div>
```

### Viewport Configuration

```html
<!-- src/app.html -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
/* Safe area padding for notched devices */
.viewer-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## Screen Reader Testing

### Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Page load | Announce "3D model: [name]" |
| Focus canvas | Announce instructions |
| Loading | Announce progress updates |
| Error | Announce error with recovery options |
| Keyboard rotate | Silent (visual feedback only) |
| Reset camera | Announce "Camera reset" |
| Exit viewer | Announce "Exited 3D viewer" |

### Testing Tools

- **NVDA** (Windows): Free, most common
- **JAWS** (Windows): Commercial, enterprise standard
- **VoiceOver** (macOS/iOS): Built-in
- **TalkBack** (Android): Built-in

### Quick Test Checklist

- [ ] Navigate to viewer with Tab key only
- [ ] All controls reachable and operable
- [ ] Focus visible at all times
- [ ] Escape exits viewer cleanly
- [ ] Loading state announced
- [ ] Error state announced with clear message
- [ ] Model name and description announced

---

## Checklist

### WCAG 2.2 Level A
- [ ] Text alternative for 3D content (1.1.1)
- [ ] Keyboard accessible (2.1.1)
- [ ] No keyboard traps (2.1.2)
- [ ] Focus visible (2.4.7)
- [ ] Pointer gestures have alternatives (2.5.1)

### WCAG 2.2 Level AA
- [ ] Status messages programmatic (4.1.3)
- [ ] Consistent navigation (3.2.3)
- [ ] Consistent identification (3.2.4)
- [ ] Error identification (3.3.1)
- [ ] Labels or instructions (3.3.2)

### WCAG 2.2 Level AAA (Target)
- [ ] Keyboard (no exception) (2.1.3)
- [ ] Extended audio description (1.2.7)
- [ ] Sign language (1.2.6) - if video content

### Implementation
- [ ] Keyboard controls component created
- [ ] ARIA labels on all interactive elements
- [ ] Live regions for status updates
- [ ] Focus indicators visible (including high contrast)
- [ ] Reduced motion respected
- [ ] Touch targets ≥44×44px
- [ ] Screen reader tested (NVDA, VoiceOver)
