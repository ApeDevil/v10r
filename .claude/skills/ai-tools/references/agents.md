# Multi-Step Agent Orchestration

Patterns for building reliable AI agents with Vercel AI SDK v6. Agents are multi-step tool-calling loops that autonomously complete tasks.

## Agent Loop (v6 Pattern)

```typescript
import { streamText, stepCountIs, hasToolCall, convertToModelMessages, type UIMessage } from 'ai';

const result = streamText({
  model,
  messages: await convertToModelMessages(uiMessages),
  tools: {
    searchDocs: { /* ... */ },
    queryGraph: { /* ... */ },
    createItem: { /* ... */ },
    done: {
      description: 'Signal that the task is complete.',
      inputSchema: z.object({
        summary: z.string().describe('Brief summary of what was accomplished'),
      }),
      execute: async ({ summary }) => ({ completed: true, summary }),
    },
  },

  // Stop conditions (first to trigger wins)
  stopWhen: [
    stepCountIs(8),           // Hard safety limit
    hasToolCall('done'),      // Graceful completion
  ],

  // Per-step configuration
  prepareStep: async ({ stepNumber, messages }) => {
    // Switch to cheaper model for later exploration steps
    if (stepNumber > 5) {
      return { model: registry.languageModel('groq:llama-3.1-8b-instant') };
    }
    // Could also adjust tools, system prompt, or temperature per step
    return {};
  },

  onStepFinish: async ({ stepNumber, usage, toolResults }) => {
    // Log per-step usage for cost tracking
    await logStepUsage(stepNumber, usage);

    // Detect tool errors (they appear as tool-error parts in v5+)
    const errors = toolResults?.filter(r => r.type === 'tool-result' && r.isError);
    if (errors?.length) {
      console.error(`[agent] Tool errors in step ${stepNumber}:`, errors);
      // Don't throw — let the model self-correct in next step
    }
  },

  onFinish: async ({ totalUsage, steps }) => {
    // totalUsage = accumulated across ALL steps
    await logAgentRun({
      steps: steps.length,
      totalTokens: totalUsage.totalTokens,
    });
  },
});
```

## Stop Conditions

```typescript
import { stepCountIs, hasToolCall } from 'ai';

// Built-in conditions
stopWhen: stepCountIs(5)                    // After N steps
stopWhen: hasToolCall('done')               // When specific tool is called
stopWhen: [stepCountIs(10), hasToolCall('done')]  // First to trigger

// CRITICAL: v6 default is stepCountIs(20) — always set explicitly
// 5-8 steps is typical for production agents
```

## prepareStep — Dynamic Step Configuration

`prepareStep` runs before each step, allowing you to change parameters mid-loop:

```typescript
prepareStep: async ({ stepNumber, messages, model: currentModel }) => {
  // Model routing: cheap model for exploration, expensive for synthesis
  if (stepNumber <= 3) {
    return { model: sonnet }; // Complex reasoning in early steps
  }
  return { model: haiku }; // Simple lookups in later steps

  // Can also return:
  // { tools: { ... } }        — change available tools
  // { system: '...' }         — change system prompt
  // { temperature: 0.2 }      — adjust creativity
  // { maxOutputTokens: 500 }  — limit response length
},
```

## Error Recovery

### Tool errors don't crash the loop

In v5+, `ToolExecutionError` is removed. Errors from tool execution appear as `tool-error` content parts in the message stream. The LLM reads these and can self-correct in subsequent steps.

```typescript
// In tool execute — NEVER throw
execute: async ({ query }) => {
  try {
    const results = await searchItems(userId, query);
    return { items: results, count: results.length };
  } catch {
    // Return error object — LLM reads it and adapts
    return { error: 'Search failed. Try a different query or check your filters.' };
  }
},
```

### Callback errors are silently swallowed

Errors thrown inside `onStepFinish` and `onError` callbacks are caught internally — they don't crash the generation. This is both a safety feature and a debugging hazard:

```typescript
onStepFinish: async ({ stepNumber, usage }) => {
  try {
    await logStepUsage(stepNumber, usage); // If this fails...
  } catch (err) {
    console.error('[agent] Usage logging failed:', err); // ...you need explicit logging
    // Error is swallowed — generation continues
  }
},
```

### Provider fallback in agent context

```typescript
try {
  const result = streamText({ model: primaryModel, ... });
  return result.toUIMessageStreamResponse();
} catch (err) {
  const aiErr = classifyAIError(err);
  if (['unavailable', 'timeout', 'rate_limit'].includes(aiErr.kind)) {
    // Try fallback provider
    for (const fallback of fallbackProviders) {
      const fallbackModel = fallback.getInstance();
      if (!fallbackModel) continue;
      try {
        const result = streamText({ model: fallbackModel, ... });
        return result.toUIMessageStreamResponse();
      } catch { continue; }
    }
  }
  return json({ error: safeAIMessage(aiErr.kind) }, { status: aiErrorToStatus(aiErr.kind) });
}
```

## Human-in-the-Loop (HITL)

### Server: Mark tools requiring approval

```typescript
tools: {
  // Read tools — no approval needed
  searchDocs: { inputSchema: z.object({ ... }), execute: async (input) => { ... } },

  // Write tools — require user confirmation
  updateItem: {
    inputSchema: z.object({ id: z.string(), name: z.string() }),
    needsApproval: true, // Pauses the loop
    execute: async ({ id, name }) => {
      await updateItem(userId, id, { name });
      return { updated: true };
    },
  },

  // Destructive tools — NEVER include in automated agents
  // deleteItem, exportData, bulkUpdate
}
```

### Client: Resume after approval

```svelte
{#each message.parts as part}
  {#if part.type === 'tool-invocation' && part.state === 'call'}
    {#if part.toolName === 'updateItem'}
      <div class="approval-prompt">
        <p>Update item "{part.args.name}"?</p>
        <button onclick={() => chat.addToolOutput({
          toolCallId: part.toolCallId,
          output: { approved: true },
        })}>Approve</button>
        <button onclick={() => chat.addToolOutput({
          toolCallId: part.toolCallId,
          output: { error: 'User declined.' },
        })}>Decline</button>
      </div>
    {/if}
  {/if}
{/each}
```

## Token Cost in Multi-Step Chains

Costs scale with the number of steps because each step includes the full conversation history:

| Steps | Approximate Token Multiplier |
|-------|------------------------------|
| 1 | 1× (baseline) |
| 3 | ~2-3× |
| 5 | ~4-6× |
| 10 | ~8-15× |

### Mitigation Strategies

1. **Use `prepareStep` to route later steps to cheaper models** — exploration on Haiku, synthesis on Sonnet
2. **Keep tool results compact** — return only the fields the LLM needs, not full database rows
3. **Set `maxOutputTokens` per step** — prevent verbose intermediate reasoning
4. **Use `stopWhen` aggressively** — 5-8 steps covers most agent tasks
5. **Prompt caching** — stable system prompts cached across steps (Anthropic: `cache_control`)

## ToolLoopAgent (v6)

For standalone agent execution (not streaming to client):

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';

const agent = new ToolLoopAgent({
  model,
  instructions: 'You are a data processing agent...',
  tools: { searchDocs, transformData, saveResult },
  stopWhen: stepCountIs(10),
});

const result = await agent.run('Process the Q4 sales data');
// result.text — final response
// result.steps — array of all steps taken
// result.totalUsage — accumulated token usage
```

## Streaming Tool Progress to Client

Tool call arguments stream in v5+ — inputs arrive before execution completes:

```svelte
{#each message.parts as part}
  {#if part.type === 'tool-invocation'}
    {#if part.state === 'partial-call'}
      <!-- Arguments still streaming -->
      <div class="tool-streaming">Preparing {part.toolName}...</div>
    {:else if part.state === 'call'}
      <!-- Arguments complete, execution in progress -->
      <div class="tool-executing">Running {part.toolName}...</div>
    {:else if part.state === 'result'}
      <!-- Execution complete -->
      <ToolResult name={part.toolName} output={part.output} />
    {/if}
  {/if}
{/each}
```

## Permission Tiers

```typescript
// Read — safe for all contexts
const readTools = (userId: string) => ({
  searchItems: tool({ /* ... */ }),
  getItem: tool({ /* ... */ }),
  listNotifications: tool({ /* ... */ }),
});

// Write — authenticated sessions with write scope
const writeTools = (userId: string) => ({
  createItem: tool({ /* ... */ }),
  updateItem: tool({ needsApproval: true, /* ... */ }),
});

// Destructive — NEVER in automated agents
// deleteAccount, exportUserData, bulkDelete
// These require human-in-the-loop confirmation outside the agent loop

export function createTools(userId: string) {
  return {
    ...readTools(userId),
    ...writeTools(userId),
  };
}
```

Auth happens once at the endpoint. `userId` flows into tools via closure — tools never re-authenticate.
