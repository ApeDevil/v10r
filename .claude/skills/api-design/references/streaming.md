# SSE and Streaming

Server-Sent Events and AI SDK streaming patterns for SvelteKit.

## SSE Endpoint Design

### Named Events (Preferred)

Named events allow typed client listeners and extensible event taxonomy:

```typescript
// src/routes/api/notifications/stream/+server.ts (simplified from the real endpoint)

// Long-lived SSE: pin the function to its billable window and self-close just
// before the platform kill so EventSource reconnects cleanly (60 = Hobby ceiling).
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };
const MAX_STREAM_DURATION_MS = 55_000;

export const GET: RequestHandler = async ({ locals }) => {
  const { user } = requireApiUser(locals);
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Named event with ID (enables Last-Event-ID reconnection)
      const send = (type: string, id: string, data: unknown) =>
        controller.enqueue(encoder.encode(
          `event: ${type}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`
        ));

      // Per-user connection registry with a cap (refuse the extra tab)
      registerStream(user.id, controller);

      // Initial state as a named event (client: addEventListener('init', ...))
      send('init', 'init', { unreadCount: await getUnreadCount(user.id) });

      // Keepalive comment every 25s (prevents proxy timeout)
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 25_000);

      // Self-close before the serverless kill → clean client auto-reconnect
      lifetime = setTimeout(() => controller.close(), MAX_STREAM_DURATION_MS);
    },
    cancel() {
      // Client disconnect lands HERE — ReadableStreamDefaultController has NO
      // `signal` property; cleanup in cancel() or timers/registrations leak.
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      unregisterStream(user.id);
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

## Production Hardening (What the Real Endpoints Do)

`sveltekit-sse` is **not** a dependency of this project. The live streams (`/api/notifications/stream`, `/api/analytics/stream`) are raw `ReadableStream` hardened with:

- **Rate-limit the connect** (Upstash limiter via `$lib/server/api/rate-limit`) — a client reconnect loop is a request storm.
- **Per-user connection cap** via a registry (`registerStream`/`unregisterStream` in `$lib/server/notifications`); the extra tab gets an error event, not a stream.
- **Heartbeat comment every ~25s** to survive proxies.
- **Self-close before `maxDuration`** (close at 55s, platform kills at 60s) so `EventSource` auto-reconnects instead of dying mid-kill.
- **All cleanup in `cancel()`** — timers and registry entries leak on disconnect otherwise.

## Vercel AI SDK UI Message Stream (v6)

The AI SDK streams typed UI-message frames between `streamText()` on the server and the `Chat` class on the client over an SSE-style response. This project runs `ai@^6` — v4/v5 helpers (`toDataStreamResponse()`, `useChat()` destructuring, `maxSteps`) no longer exist.

### Server Pattern — simple case

```typescript
// src/routes/api/ai/chat/+server.ts
import { stepCountIs, streamText } from 'ai';
import { createTools } from '$lib/server/ai/tools';

export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = requireApiUser(locals);
  const { messages } = await request.json();

  const result = streamText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages,
    tools: createTools(user.id),
    stopWhen: stepCountIs(5), // v6: replaces maxSteps
    maxOutputTokens: 1000,    // v6: renamed from maxTokens
  });

  return result.toUIMessageStreamResponse(); // v6: replaces toDataStreamResponse()
};
```

### Server Pattern — orchestrated (writer + merge)

When you write your own frames (metadata, custom data parts) around the model stream, **frame order is part of the contract**. The real pattern from `$lib/server/ai/chat-orchestrator.ts`:

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Open the assistant message frame BEFORE any other write. A `message-metadata`
    // (or `data-*`) frame sent before `start` makes the v6 client materialize an
    // EMPTY first assistant message to hold it, then the merged stream's own `start`
    // (different id) opens a SECOND — one answer renders as two bubbles.
    // (Real production bug in this codebase; see chat-orchestrator.ts.)
    writer.write({ type: 'start', messageId: assistantMsgId });
    writer.write({ type: 'message-metadata', messageMetadata: { /* ... */ } });

    const result = streamText({ /* ... */ });
    // sendStart: false — we already opened the frame; reusing our id also makes
    // the client message id match the persisted DB row.
    writer.merge(result.toUIMessageStream({ sendStart: false }));
  },
});

return createUIMessageStreamResponse({ stream });
```

**Rule:** metadata before the merge without your own `start` = split message. Metadata after `start` = fine.

### UI Message Stream Frame Types (v6)

| Frame | Content |
|-------|---------|
| `start` | Opens the assistant message (carries `messageId`) — must precede all other frames |
| `start-step` / `finish-step` | Step boundaries in multi-step (tool) turns |
| `text-start` / `text-delta` / `text-end` | Streamed text part lifecycle |
| `reasoning-*` | Extended thinking deltas |
| `tool-input-start` / `tool-input-delta` / `tool-input-available` | Tool call arguments streaming |
| `tool-output-available` | Tool execution result |
| `message-metadata` | Message metadata, merged into the open message |
| `data-*` | Custom typed data parts |
| `error` | Error during generation |
| `finish` | Closes the message (stop reason, usage) |

### Client Pattern (v6)

`useChat()` destructuring is v4/v5. v6 `@ai-sdk/svelte` exposes the `Chat` class (real usage: `$lib/state/chatbot-session.svelte.ts`, which also lazy-imports the SDK to keep it out of the shell bundle):

```typescript
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: '/api/ai/chatbot',
    headers: CSRF_HEADER,
  }),
});
// chat.messages (reactive), chat.status, chat.sendMessage({ text }, { body })
```

### AI SDK Version Note

v5→v6 renames that make older examples fail: `toDataStreamResponse()` → `toUIMessageStreamResponse()`; `maxSteps` → `stopWhen: stepCountIs(n)`; `maxTokens` → `maxOutputTokens`; `useChat()` hook → `Chat` class. Tool `parameters` → `inputSchema`/`outputSchema` landed in v5 and still applies. This file follows the installed `ai@^6` — trust it over training data.

## Serverless Limits

| Platform | Limit | SSE Impact |
|----------|-------|------------|
| Vercel Hobby | 10s default, **60s max** via `maxDuration` | Proven live: set `maxDuration: 60`, self-close at 55s, let `EventSource` reconnect |
| Vercel Pro | 300s max | Raise `maxDuration` to 300 and the self-close to ~290s |
| Vercel Enterprise | Up to 900s | Sufficient for most SSE |
| Bun container (self-hosted) | No limit | Indefinite SSE connections work |

### Vercel Configuration

```typescript
// src/routes/api/notifications/stream/+server.ts
export const config = {
  runtime: 'nodejs22.x',
  maxDuration: 60, // seconds — Hobby ceiling; pair with a self-close just under it
};
```

**Strategy (live in prod):** long-lived SSE runs on Vercel with the self-close + auto-reconnect cycle above — each reconnect re-auths and re-reads initial state, which is why the endpoint rate-limits connects. AI streaming (finite, <60s) fits inside a single window on all plans.

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
