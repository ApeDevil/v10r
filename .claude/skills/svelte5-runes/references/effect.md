# $effect

Side effects. Runs after render, after DOM updates. Dependencies tracked automatically.

```svelte
<script lang="ts">
  let count = $state(0);

  $effect(() => {
    console.log('Count:', count);
    return () => console.log('Cleanup');
  });
</script>
```

## When Effects Run

1. After initial render (not during SSR)
2. After dependencies change
3. After DOM updates

Updates are batched.

## Cleanup

```svelte
<script lang="ts">
  let active = $state(true);

  $effect(() => {
    if (!active) return;

    const interval = setInterval(() => console.log('Tick'), 1000);

    // Cleanup runs before re-run and on unmount
    return () => clearInterval(interval);
  });
</script>
```

## Common Patterns

**Event listeners**
```svelte
<script lang="ts">
  let mouseX = $state(0);

  $effect(() => {
    function handleMove(e: MouseEvent) { mouseX = e.clientX; }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  });
</script>
```

**WebSocket**
```svelte
<script lang="ts">
  let connected = $state(false);
  let roomId = $state('general');

  $effect(() => {
    const ws = new WebSocket(`wss://chat.example.com/${roomId}`);
    ws.onopen = () => { connected = true; };
    ws.onclose = () => { connected = false; };
    return () => ws.close();
  });
</script>
```

**Canvas**
```svelte
<script lang="ts">
  let canvas: HTMLCanvasElement;
  let color = $state('#ff0000');

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 100, 100);
  });
</script>
```

**Local storage sync**
```svelte
<script lang="ts">
  let theme = $state<'light' | 'dark'>('light');

  $effect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  });

  $effect(() => {
    localStorage.setItem('theme', theme);
  });
</script>
```

**Debounced search**
```svelte
<script lang="ts">
  let query = $state('');
  let results = $state([]);

  $effect(() => {
    const q = query;
    if (!q) { results = []; return; }

    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${q}`);
      results = await res.json();
    }, 300);

    return () => clearTimeout(timeout);
  });
</script>
```

## $effect.pre()

Runs before DOM updates.

```svelte
<script lang="ts">
  let items = $state([]);
  let container: HTMLDivElement;

  $effect.pre(() => {
    const scrollPos = container?.scrollTop;  // Before update
  });

  $effect(() => {
    if (container) container.scrollTop = container.scrollHeight;  // After update
  });
</script>
```

## Dependency Tracking

Dependencies tracked synchronously only.

```svelte
<script lang="ts">
  let a = $state(1);
  let b = $state(2);

  $effect(() => {
    console.log('a:', a);  // Tracked

    setTimeout(() => {
      console.log('b:', b);  // NOT tracked
    }, 1000);
  });
</script>
```

**Async pattern**
```svelte
<script lang="ts">
  let userId = $state(1);
  let user = $state(null);

  $effect(() => {
    const id = userId;  // Capture before await

    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(data => { user = data; });
  });
</script>
```

## When NOT to Use

**For computed values**
```svelte
<!-- WRONG --> $effect(() => { doubled = count * 2; });
<!-- RIGHT --> let doubled = $derived(count * 2);
```

**For event handlers**
```svelte
<!-- WRONG --> $effect(() => { if (clicked) doSomething(); });
<!-- RIGHT --> <button onclick={doSomething}>
```

**For synchronizing state**
```svelte
<!-- WRONG --> $effect(() => { localValue = value; });
<!-- RIGHT --> let localValue = $derived(value);
```
