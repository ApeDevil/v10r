# SSE and Streaming

Server-Sent Events and AI SDK streaming patterns for SvelteKit.

## SSE Endpoint Design

### Named Events (Preferred)

Named events allow typed client listeners and extensible event taxonomy:

```typescript
// src/routes/api/notifications/stream/+server.ts
export const GET: RequestHandler = async ({ locals }) => {
  const { user } = requireApiUser(locals);

  const stream = new ReadableStream({
    start(ctrl) {
      const encoder = new TextEncoder();

      // Send retry hint on connect
      ctrl.enqueue(encoder.encode(`retry: 5000\n\n`));

      // Named event with ID (enables Last-Event-ID reconnection)
      const send = (type: string, id: string, data: unknown) => {
        ctrl.enqueue(encoder.encode(
          `event: ${type}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`
        ));
      };

      // Keepalive comment every 25s (prevents proxy timeout)
      const ping = setInterval(() => {
        ctrl.enqueue(encoder.encode(`:\n\n`));
      }, 25_000);

      // Subscribe to notifications
      const unsubscribe = notificationBus.subscribe(user.id, (notification) => {
        send('notification', notification.id, notification);
      });

      // Cleanup on client disconnect
      ctrl.signal?.addEventListener('abort', () => {
        clearInterval(ping);
        unsubscribe();
      });
    },
    cancel() {
      // Also called on disconnect in some runtimes
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // NGINX: disable response buffering
    },
  });
};
```

### Client Consumption

```typescript
const source = new EventSource('/api/notifications/stream');

// Typed listeners for named events
source.addEventListener('notification', (e) => {
  const data = JSON.parse(e.data);
  // e.lastEventId available for reconnection tracking
});

source.addEventListener('session-expired', () => {
  source.close();
  goto('/auth/login');
});

// Default handler (only catches unnamed 'message' events)
source.onmessage = (e) => { /* ... */ };

// Auto-reconnect is built into EventSource
source.onerror = () => {
  // EventSource auto-reconnects with Last-Event-ID header
  // retry: hint from server controls delay
};
```

## SSE Event Field Reference

| Field | Purpose | Example |
|-------|---------|---------|
| `event:` | Named event type (default: `message`) | `event: notification` |
| `id:` | Event ID for `Last-Event-ID` reconnection | `id: notif_abc123` |
| `data:` | Payload (multi-line: each `data:` line joined with `\n`) | `data: {"title":"..."}` |
| `retry:` | Client reconnect delay in ms (server hint) | `retry: 5000` |
| `:` | Comment line (used for keepalive) | `:\n\n` |

### Event Contract Definition

Document each event type with its payload schema:

```typescript
// SSE Event Contract
// event: notification
//   Payload: { id: string, type: string, title: string, body?: string, created_at: string }
//   Sent: when a new notification is created for the connected user

// event: notification-read
//   Payload: { id: string }
//   Sent: when a notification is marked as read (from another tab/device)

// event: session-expired
//   Payload: (none)
//   Sent: when the user's session is invalidated server-side
//   Client action: close stream, redirect to login
```

## sveltekit-sse Library

For production SSE, prefer `sveltekit-sse` over raw `ReadableStream`. It handles keepalive, disconnect detection, and stream lifecycle issues that have caused file descriptor leaks in raw SvelteKit streams.

```bash
bun add sveltekit-sse
```

```typescript
import { produce } from 'sveltekit-sse';

export const GET: RequestHandler = () => {
  return produce(async function start({ emit, lock }) {
    // emit() sends named events
    // lock() prevents concurrent reads
    // Automatic ping keepalive (30s default)
    // Automatic cleanup on client disconnect
  });
};
```

## Vercel AI SDK Data Stream Protocol

The AI SDK uses a custom SSE-based protocol between `streamText()` on the server and `useChat()` on the client.

### Server Pattern

```typescript
// src/routes/api/ai/chat/+server.ts
import { streamText } from 'ai';
import { createTools } from '$lib/server/ai/tools';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = requireApiUser(locals);
  const { messages } = await request.json();

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages,
    tools: createTools(user.id),
    maxSteps: 5,
    maxTokens: 1000,
  });

  // THE pattern that works — not legacy AIStream helpers
  return result.toDataStreamResponse();
};
```

### Data Stream Part Types

| Part Type | Content |
|-----------|---------|
| `text-delta` | Streamed text chunk |
| `tool-input-start/delta/finish` | Tool call arguments streaming |
| `tool-result` | Tool execution result |
| `reasoning-delta` | Extended thinking (Anthropic) |
| `error` | Error during generation |
| `finish` | Final metadata (stop reason, token usage) |

### Client Pattern

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/ai/chat',
  });
</script>
```

### AI SDK Version Note

AI SDK 5 renamed `parameters` to `inputSchema` and added `outputSchema` in tool definitions, aligning with MCP. Check which version you're running.

## Serverless Limits

| Platform | Limit | SSE Impact |
|----------|-------|------------|
| Vercel Hobby | 10s function timeout | SSE may work with streaming (unconfirmed ceiling) |
| Vercel Pro | 60s default, 300s configurable | Set `maxDuration` in route config |
| Vercel Enterprise | Up to 900s | Sufficient for most SSE |
| Bun container (self-hosted) | No limit | Indefinite SSE connections work |

### Vercel Configuration

```typescript
// src/routes/api/notifications/stream/+server.ts
export const config = {
  maxDuration: 60, // seconds
};
```

**Strategy:** Container deployment is primary for indefinite SSE (notifications). Vercel gets polling fallback (`invalidate()`). AI streaming (finite, <60s) works on all Vercel plans.

## Multi-Instance SSE

In-memory event registries only work on a single server instance. For multi-instance deployments:

```
[Instance A] ← client A    [Instance B] ← client B
     │                            │
     └────── PostgreSQL ──────────┘
          LISTEN / NOTIFY

(or Redis pub/sub)
```

No SvelteKit library abstracts this. You must bridge the event bus yourself using PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub to forward events to per-instance SSE connections.

## Documenting SSE Endpoints

- **OpenAPI 3.1**: Can represent `text/event-stream` content type but cannot model individual events
- **OpenAPI 3.2** (draft): Adds `itemSchema` for SSE — not yet available
- **AsyncAPI 3.0**: Designed for event-driven APIs, natively models SSE with named channels

**Practical approach:** Document event contracts in code comments (see Event Contract Definition above). Add AsyncAPI spec only if external consumers need formal documentation.
