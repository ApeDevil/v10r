# Streaming Patterns

Deep dive into Server-Sent Events and streaming UI patterns for LLM responses.

## Why Streaming

LLM responses take 2-10 seconds. Without streaming, users stare at a blank screen. Streaming provides:
- Immediate feedback (first token in ~200ms)
- Perceived faster responses
- Ability to abort early

## Server-Sent Events (SSE)

Vercel AI SDK uses SSE under the hood via `toDataStreamResponse()`.

### Protocol Format

```
data: {"type":"text","text":"Hello"}

data: {"type":"text","text":" world"}

data: {"type":"finish","usage":{"promptTokens":10,"completionTokens":5}}

```

### Custom SSE Endpoint

```typescript
// src/routes/api/stream/+server.ts
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generateChunks()) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Abort Handling

### Client-Side Abort

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  const { messages, stop, isLoading } = useChat();
</script>

{#if $isLoading}
  <button onclick={stop}>Stop generating</button>
{/if}
```

### Server-Side Cleanup

```typescript
export async function POST({ request }) {
  const { messages } = await request.json();

  // Check if request was aborted
  request.signal.addEventListener('abort', () => {
    console.log('Request aborted by client');
    // Cleanup resources
  });

  const result = streamText({
    model,
    messages,
    abortSignal: request.signal, // Pass to AI SDK
  });

  return result.toDataStreamResponse();
}
```

## Chunked Response Processing

### Word-by-Word Rendering

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  const { messages } = useChat();

  // Messages update incrementally as tokens arrive
</script>

{#each $messages as message}
  <div class="message">
    {#each message.content.split(' ') as word, i}
      <span style="animation-delay: {i * 50}ms" class="fade-in">
        {word}{' '}
      </span>
    {/each}
  </div>
{/each}
```

### Markdown Rendering During Stream

```svelte
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';
  import { marked } from 'marked';

  const { messages } = useChat();
</script>

{#each $messages as message}
  <div class="prose">
    {@html marked(message.content)}
  </div>
{/each}
```

## Backpressure Handling

If client can't consume tokens fast enough:

```typescript
const stream = new ReadableStream({
  async pull(controller) {
    const chunk = await getNextChunk();
    if (chunk) {
      controller.enqueue(chunk);
    } else {
      controller.close();
    }
  },
});
```

## Connection Resilience

### Reconnection Strategy

```typescript
function connectWithRetry(url: string, maxRetries = 3) {
  let retries = 0;

  function connect() {
    const eventSource = new EventSource(url);

    eventSource.onerror = () => {
      if (retries < maxRetries) {
        retries++;
        setTimeout(connect, 1000 * retries);
      }
    };

    return eventSource;
  }

  return connect();
}
```

## Performance Considerations

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Network latency | First token delay | Use edge functions |
| Token batching | Choppy rendering | SDK batches by default |
| DOM updates | Jank on long responses | Use `requestAnimationFrame` |
| Memory | Long conversations grow | Limit message history |
