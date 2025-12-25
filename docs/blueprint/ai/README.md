# AI Assistant Architecture

Persistent, conversational AI assistant integrated into the app shell sidebar.

---

## Overview

The AI Assistant is a chat interface accessible from the sidebar header. Unlike QuickSearch (ephemeral, one-shot), the assistant maintains conversation history across modal open/close cycles.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Sidebar        Main Content                                │
│   ┌────────┐                                                 │
│   │ 🦖     │                                                 │
│   │ 🔍     │     (page content)                              │
│   │ 💬     │ ← AI Assistant trigger                          │
│   │        │                                                 │
│   │  nav   │                                                 │
│   │        │                                                 │
│   │ [user] │                                                 │
│   └────────┘                                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Strategy

**Provider-agnostic** architecture using [Vercel AI SDK](https://ai-sdk.dev/).

| Layer | Purpose | Location |
|-------|---------|----------|
| **UI Components** | Chat modal, messages, input | `src/lib/components/composites/chatbot/` |
| **State Management** | Conversation persistence | `src/lib/stores/chat.svelte.ts` |
| **API Endpoint** | Streaming chat completions | `src/routes/api/chat/+server.ts` |
| **Provider Abstraction** | Model configuration | `src/lib/server/ai/` |

### Why Vercel AI SDK?

- Framework-agnostic core with first-class SvelteKit support
- Unified API across providers (Anthropic, OpenAI, Google, etc.)
- Built-in streaming with `toUIMessageStreamResponse()`
- Type-safe message handling with `UIMessage` type
- Tool/function calling support

---

## Installation

```bash
bun add ai @ai-sdk/svelte
bun add @ai-sdk/anthropic  # or @ai-sdk/openai, @ai-sdk/google, etc.
```

---

## Provider Configuration

### Provider Abstraction

```typescript
// src/lib/server/ai/provider.ts
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { AI_PROVIDER, AI_API_KEY } from '$env/static/private';

export type AIProvider = 'anthropic' | 'openai' | 'google';

const providers = {
  anthropic: () => createAnthropic({ apiKey: AI_API_KEY }),
  openai: () => createOpenAI({ apiKey: AI_API_KEY }),
  // Add more providers as needed
};

export function getProvider() {
  const provider = AI_PROVIDER as AIProvider;
  const factory = providers[provider];

  if (!factory) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  return factory();
}
```

### Model Configuration

```typescript
// src/lib/server/ai/config.ts
import { AI_PROVIDER, AI_MODEL } from '$env/static/private';

export const aiConfig = {
  provider: AI_PROVIDER,
  model: AI_MODEL,

  // Default model per provider
  defaultModels: {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
    google: 'gemini-1.5-pro',
  } as const,

  // System prompt for the assistant
  systemPrompt: `You are a helpful assistant for the Velociraptor application.
Be concise and helpful. Format responses with markdown when appropriate.`,
};

export function getModel() {
  return AI_MODEL || aiConfig.defaultModels[AI_PROVIDER as keyof typeof aiConfig.defaultModels];
}
```

### Environment Variables

```bash
# .env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514  # Optional, uses default if not set
```

---

## API Endpoint

### Streaming Chat Endpoint

```typescript
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { getProvider } from '$lib/server/ai/provider';
import { getModel, aiConfig } from '$lib/server/ai/config';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Optional: require authentication
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { messages }: { messages: UIMessage[] } = await request.json();

    const provider = getProvider();
    const model = getModel();

    const result = streamText({
      model: provider(model),
      system: aiConfig.systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return json({ error: 'Failed to process chat request' }, { status: 500 });
  }
};
```

---

## Client State Management

### Chat Store

```typescript
// src/lib/stores/chat.svelte.ts
import { browser } from '$app/environment';

const STORAGE_KEY = 'velociraptor-chat-history';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// CHAT STATE
// ═══════════════════════════════════════════════════════════════

let chatOpen = $state(false);
let messages = $state<ChatMessage[]>(loadMessages());

function loadMessages(): ChatMessage[] {
  if (!browser) return [];
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages() {
  if (!browser) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.warn('Failed to save chat history:', e);
  }
}

// Auto-save on message change
$effect(() => {
  if (browser && messages.length > 0) {
    saveMessages();
  }
});

export const chatStore = {
  // State
  get isOpen() { return chatOpen; },
  get messages() { return messages; },
  get hasMessages() { return messages.length > 0; },

  // Modal controls
  open() { chatOpen = true; },
  close() { chatOpen = false; },
  toggle() { chatOpen = !chatOpen; },

  // Message management
  addMessage(role: 'user' | 'assistant', content: string) {
    messages.push({
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
    });
  },

  updateLastAssistantMessage(content: string) {
    const last = messages.findLast(m => m.role === 'assistant');
    if (last) {
      last.content = content;
    }
  },

  clear() {
    messages = [];
    if (browser) {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  },
};
```

---

## UI Components

### Component Structure

```
src/lib/components/composites/chatbot/
├── Chatbot.svelte           # Modal container + chat logic
├── ChatbotTrigger.svelte    # Sidebar trigger (adapts to rail/expanded)
├── ChatMessage.svelte       # Individual message bubble
├── ChatInput.svelte         # Input field + send button
└── index.ts                 # Barrel exports
```

### Chatbot Modal

```svelte
<!-- src/lib/components/composites/chatbot/Chatbot.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { Chat } from '@ai-sdk/svelte';
  import { cn } from '$lib/utils/cn';
  import { chatStore } from '$lib/stores/chat.svelte';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import Icon from '@iconify/svelte';

  const chat = new Chat({
    api: '/api/chat',
    onFinish: (message) => {
      // Persist completed message
      chatStore.addMessage('assistant', message.content);
    },
  });

  function handleSend(text: string) {
    chatStore.addMessage('user', text);
    chat.sendMessage({ text });
  }

  function handleClear() {
    chatStore.clear();
    // Note: Chat class doesn't have a clear method, may need to recreate
  }
</script>

<!-- Global keyboard shortcut -->
<svelte:window
  onkeydown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      chatStore.toggle();
    }
  }}
/>

<Dialog.Root bind:open={chatStore.isOpen}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-overlay bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <Dialog.Content
      class={cn(
        'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
        'flex h-[600px] w-full max-w-2xl flex-col',
        'rounded-lg border border-border bg-bg shadow-xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out'
      )}
    >
      <!-- Header -->
      <header class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:bot" class="h-5 w-5 text-primary" />
          <Dialog.Title class="font-semibold text-fg">AI Assistant</Dialog.Title>
        </div>
        <div class="flex items-center gap-2">
          {#if chatStore.hasMessages}
            <button
              class="rounded p-1.5 text-muted hover:bg-muted/10 hover:text-fg"
              onclick={handleClear}
              title="Clear conversation"
            >
              <Icon icon="lucide:trash-2" class="h-4 w-4" />
            </button>
          {/if}
          <Dialog.Close
            class="rounded p-1.5 text-muted hover:bg-muted/10 hover:text-fg"
          >
            <Icon icon="lucide:x" class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </Dialog.Close>
        </div>
      </header>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if chat.messages.length === 0}
          <div class="flex h-full flex-col items-center justify-center text-center text-muted">
            <Icon icon="lucide:message-circle" class="mb-3 h-12 w-12 opacity-50" />
            <p class="text-lg font-medium">How can I help you?</p>
            <p class="mt-1 text-sm">Ask me anything about your project.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each chat.messages as message (message.id)}
              <ChatMessage
                role={message.role}
                parts={message.parts}
              />
            {/each}
          </div>
        {/if}
      </div>

      <!-- Input -->
      <ChatInput
        onsubmit={handleSend}
        disabled={chat.isLoading}
        placeholder="Ask anything..."
      />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### ChatMessage Component

```svelte
<!-- src/lib/components/composites/chatbot/ChatMessage.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import Icon from '@iconify/svelte';

  interface MessagePart {
    type: 'text' | 'tool-call' | 'reasoning';
    text?: string;
  }

  interface Props {
    role: 'user' | 'assistant';
    parts: MessagePart[];
    class?: string;
  }

  let { role, parts, class: className }: Props = $props();
</script>

<div
  class={cn(
    'flex gap-3',
    role === 'user' ? 'flex-row-reverse' : 'flex-row',
    className
  )}
>
  <!-- Avatar -->
  <div
    class={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
      role === 'user' ? 'bg-primary text-white' : 'bg-muted/20 text-muted'
    )}
  >
    <Icon
      icon={role === 'user' ? 'lucide:user' : 'lucide:bot'}
      class="h-4 w-4"
    />
  </div>

  <!-- Message content -->
  <div
    class={cn(
      'max-w-[80%] rounded-lg px-4 py-2',
      role === 'user'
        ? 'bg-primary text-white'
        : 'bg-muted/10 text-fg'
    )}
  >
    {#each parts as part}
      {#if part.type === 'text' && part.text}
        <div class="prose prose-sm dark:prose-invert">
          {part.text}
        </div>
      {/if}
    {/each}
  </div>
</div>
```

### ChatInput Component

```svelte
<!-- src/lib/components/composites/chatbot/ChatInput.svelte -->
<script lang="ts">
  import { cn } from '$lib/utils/cn';
  import Icon from '@iconify/svelte';

  interface Props {
    onsubmit: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
    class?: string;
  }

  let {
    onsubmit,
    disabled = false,
    placeholder = 'Type a message...',
    class: className,
  }: Props = $props();

  let input = $state('');

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = input.trim();
    if (text && !disabled) {
      onsubmit(text);
      input = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as SubmitEvent);
    }
  }
</script>

<form
  class={cn('border-t border-border p-4', className)}
  onsubmit={handleSubmit}
>
  <div class="flex items-end gap-2">
    <textarea
      bind:value={input}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      rows="1"
      class={cn(
        'flex-1 resize-none rounded-lg border border-border bg-bg px-3 py-2',
        'text-fg placeholder:text-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    />
    <button
      type="submit"
      disabled={disabled || !input.trim()}
      class={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        'bg-primary text-white',
        'hover:bg-primary/90',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      {#if disabled}
        <Icon icon="lucide:loader-2" class="h-5 w-5 animate-spin" />
      {:else}
        <Icon icon="lucide:send" class="h-5 w-5" />
      {/if}
    </button>
  </div>
  <p class="mt-2 text-xs text-muted">
    Press Enter to send, Shift+Enter for new line
  </p>
</form>
```

### ChatbotTrigger (Sidebar)

```svelte
<!-- src/lib/components/composites/chatbot/ChatbotTrigger.svelte -->
<script lang="ts">
  import Icon from '@iconify/svelte';
  import { cn } from '$lib/utils/cn';
  import { chatStore } from '$lib/stores/chat.svelte';

  interface Props {
    collapsed?: boolean;
  }

  let { collapsed = false }: Props = $props();
</script>

{#if collapsed}
  <!-- Rail mode: icon only -->
  <button
    class="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-muted/10 hover:text-fg"
    onclick={() => chatStore.open()}
    aria-label="Open AI Assistant"
  >
    <Icon icon="lucide:bot" class="h-5 w-5" />
  </button>
{:else}
  <!-- Expanded mode: styled as fake input -->
  <button
    class={cn(
      'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-bg/50 px-3',
      'text-muted hover:border-muted hover:text-fg',
      'transition-colors duration-fast'
    )}
    onclick={() => chatStore.open()}
  >
    <Icon icon="lucide:bot" class="h-4 w-4" />
    <span class="flex-1 text-left text-sm">Ask AI...</span>
    <kbd class="rounded bg-muted/20 px-1.5 py-0.5 text-xs">⌘J</kbd>
  </button>
{/if}
```

### Barrel Export

```typescript
// src/lib/components/composites/chatbot/index.ts
export { default as Chatbot } from './Chatbot.svelte';
export { default as ChatbotTrigger } from './ChatbotTrigger.svelte';
export { default as ChatMessage } from './ChatMessage.svelte';
export { default as ChatInput } from './ChatInput.svelte';
```

---

## Sidebar Integration

Add the chatbot trigger to the sidebar header, below the search trigger:

```svelte
<!-- src/lib/components/shell/Sidebar.svelte (header section) -->
<script>
  import { QuickSearchTrigger, Chatbot, ChatbotTrigger } from '$lib/components/composites';

  let searchOpen = $state(false);
</script>

<aside class="sidebar">
  <!-- Header -->
  <div class="sidebar-header">
    <SidebarLogo {collapsed} />
    <QuickSearchTrigger {collapsed} onclick={() => searchOpen = true} />
    <ChatbotTrigger {collapsed} />
  </div>

  <!-- ... nav, footer ... -->
</aside>

<!-- Modals (rendered at root level) -->
<QuickSearch bind:open={searchOpen} items={searchItems} />
<Chatbot />
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open QuickSearch |
| `⌘J` / `Ctrl+J` | Open AI Assistant |
| `Escape` | Close active modal |
| `Enter` | Send message (in chat) |
| `Shift+Enter` | New line (in chat) |

---

## Persistence Strategies

### Session Storage (Default)

Messages persist within the browser tab session. Lost on tab close.

```typescript
// Already implemented in chatStore
sessionStorage.setItem('velociraptor-chat-history', JSON.stringify(messages));
```

### Local Storage (Optional)

For persistence across browser sessions:

```typescript
// src/lib/stores/chat.svelte.ts
const STORAGE_KEY = 'velociraptor-chat-history';
const STORAGE_TYPE: 'session' | 'local' = 'local'; // Change here

const storage = STORAGE_TYPE === 'local' ? localStorage : sessionStorage;
```

### Database (Authenticated Users)

For cross-device persistence, store conversations in the database:

```typescript
// src/routes/api/chat/history/+server.ts
export async function GET({ locals }) {
  if (!locals.user) return json({ messages: [] });

  const history = await db.chatHistory.findFirst({
    where: { userId: locals.user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return json({ messages: history?.messages ?? [] });
}

export async function POST({ request, locals }) {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

  const { messages } = await request.json();

  await db.chatHistory.upsert({
    where: { userId: locals.user.id },
    create: { userId: locals.user.id, messages },
    update: { messages },
  });

  return json({ success: true });
}
```

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| **API Key Exposure** | Server-side only (`$env/static/private`) |
| **Rate Limiting** | Implement per-user rate limits in endpoint |
| **Input Validation** | Validate message format before sending to provider |
| **Content Moderation** | Optional: Add content filtering before/after |
| **Cost Control** | Set max tokens, implement usage tracking |

### Rate Limiting Example

```typescript
// src/routes/api/chat/+server.ts
import { RateLimiter } from '$lib/server/rate-limiter';

const limiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 requests per minute
});

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  const ip = getClientAddress();
  const key = locals.user?.id ?? ip;

  if (!limiter.check(key)) {
    return json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ... rest of handler
};
```

---

## Comparison: QuickSearch vs AI Assistant

| Feature | QuickSearch | AI Assistant |
|---------|-------------|--------------|
| **Purpose** | Navigation & actions | Conversational help |
| **Trigger** | `⌘K` | `⌘J` |
| **Modal size** | `max-w-lg` | `max-w-2xl` |
| **State** | Ephemeral | Persistent |
| **Content** | Static list | Streaming messages |
| **Backend** | None (client-side filter) | API endpoint + AI provider |
| **Complexity** | Simple | Medium |

---

## File Structure Summary

```
src/
├── lib/
│   ├── components/
│   │   └── composites/
│   │       ├── chatbot/
│   │       │   ├── Chatbot.svelte
│   │       │   ├── ChatbotTrigger.svelte
│   │       │   ├── ChatMessage.svelte
│   │       │   ├── ChatInput.svelte
│   │       │   └── index.ts
│   │       └── quick-search/
│   │           └── ...
│   ├── stores/
│   │   ├── chat.svelte.ts
│   │   └── ui.svelte.ts
│   └── server/
│       └── ai/
│           ├── provider.ts
│           └── config.ts
├── routes/
│   └── api/
│       └── chat/
│           └── +server.ts
└── ...

docs/blueprint/ai/
├── README.md          # This file
├── providers.md       # Provider-specific setup (future)
└── persistence.md     # Storage strategies (future)
```

---

## Related

- [app-shell.md](../app-shell.md) - Sidebar integration
- [design/components.md](../design/components.md) - Component patterns
- [state.md](../state.md) - State management patterns
- [api.md](../api.md) - API endpoint patterns

---

## Sources

- [Vercel AI SDK - Svelte](https://ai-sdk.dev/docs/getting-started/svelte)
- [AI SDK Introduction](https://ai-sdk.dev/docs/introduction)
- [@ai-sdk/svelte Package](https://www.npmjs.com/package/@ai-sdk/svelte)
- [Vercel AI Chatbot (SvelteKit)](https://github.com/vercel/ai-chatbot-svelte)
