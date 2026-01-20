# AI Observability

Logging, tracing, and monitoring for LLM-powered applications.

## What to Observe

| Metric | Purpose |
|--------|---------|
| Latency (p50, p95, p99) | Performance SLAs |
| Token usage | Cost tracking |
| Error rate | Reliability |
| Cache hit rate | Cost efficiency |
| Model distribution | Routing effectiveness |

## Minimum Logging Schema

```typescript
interface AIRequestLog {
  // Identity
  requestId: string;
  userId?: string;
  sessionId?: string;

  // Request
  model: string;
  promptTokens: number;
  maxTokens: number;

  // Response
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;

  // Status
  status: 'success' | 'error';
  errorCode?: string;

  // Metadata
  cached: boolean;
  tools?: string[];
  timestamp: string;
}
```

### Implementation

```typescript
import { streamText } from 'ai';

export async function POST({ request, locals }) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const { messages } = await request.json();

    const result = streamText({
      model,
      messages,
      onFinish: (response) => {
        // Log after completion
        console.log(JSON.stringify({
          requestId,
          userId: locals.user?.id,
          model: 'claude-3-5-sonnet-20241022',
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs: Date.now() - startTime,
          status: 'success',
          cached: false,
          timestamp: new Date().toISOString(),
        }));
      },
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.log(JSON.stringify({
      requestId,
      userId: locals.user?.id,
      model: 'claude-3-5-sonnet-20241022',
      latencyMs: Date.now() - startTime,
      status: 'error',
      errorCode: error.code || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    }));

    throw error;
  }
}
```

## OpenTelemetry Integration

Distributed tracing for AI workflows.

### Setup

```typescript
// src/lib/server/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  serviceName: 'velociraptor-ai',
});

sdk.start();
```

### Tracing AI Calls

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('ai-service');

export async function generateWithTrace(prompt: string) {
  return tracer.startActiveSpan('llm.generate', async (span) => {
    span.setAttribute('llm.model', 'claude-3-5-sonnet');
    span.setAttribute('llm.prompt.length', prompt.length);

    try {
      const result = await generateText({ model, prompt });

      span.setAttribute('llm.tokens.prompt', result.usage.promptTokens);
      span.setAttribute('llm.tokens.completion', result.usage.completionTokens);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;

    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;

    } finally {
      span.end();
    }
  });
}
```

### Multi-Step Agent Tracing

```typescript
async function runAgent(query: string) {
  return tracer.startActiveSpan('agent.run', async (parentSpan) => {
    parentSpan.setAttribute('agent.query', query);

    // Step 1: Retrieve context
    const context = await tracer.startActiveSpan('agent.retrieve', async (span) => {
      const docs = await vectorSearch(query);
      span.setAttribute('retrieve.doc_count', docs.length);
      span.end();
      return docs;
    });

    // Step 2: Generate response
    const response = await tracer.startActiveSpan('agent.generate', async (span) => {
      const result = await generateText({
        model,
        prompt: buildPrompt(query, context),
      });
      span.setAttribute('generate.tokens', result.usage.totalTokens);
      span.end();
      return result;
    });

    parentSpan.end();
    return response;
  });
}
```

## Cost Tracking

### Per-Model Pricing

```typescript
const PRICING = {
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 }, // per 1M tokens
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
};

function calculateCost(model: string, usage: Usage): number {
  const rates = PRICING[model];
  if (!rates) return 0;

  const inputCost = (usage.promptTokens / 1_000_000) * rates.input;
  const outputCost = (usage.completionTokens / 1_000_000) * rates.output;

  return inputCost + outputCost;
}
```

### Daily Cost Report

```typescript
async function getDailyCosts() {
  const logs = await getLogs({ date: today() });

  const byModel = {};
  for (const log of logs) {
    const cost = calculateCost(log.model, log);
    byModel[log.model] = (byModel[log.model] || 0) + cost;
  }

  return {
    total: Object.values(byModel).reduce((a, b) => a + b, 0),
    byModel,
    requestCount: logs.length,
  };
}
```

## Alerting

### Anomaly Detection

```typescript
// Alert on unusual patterns
function checkAnomalies(metrics: Metrics) {
  const alerts = [];

  // High error rate
  if (metrics.errorRate > 0.05) {
    alerts.push({
      type: 'high_error_rate',
      value: metrics.errorRate,
      threshold: 0.05,
    });
  }

  // Latency spike
  if (metrics.p99Latency > 10000) {
    alerts.push({
      type: 'latency_spike',
      value: metrics.p99Latency,
      threshold: 10000,
    });
  }

  // Cost anomaly (2x daily average)
  if (metrics.dailyCost > metrics.avgDailyCost * 2) {
    alerts.push({
      type: 'cost_anomaly',
      value: metrics.dailyCost,
      threshold: metrics.avgDailyCost * 2,
    });
  }

  return alerts;
}
```

## Dashboard Queries

### Grafana/PromQL Examples

```promql
# Request rate
rate(ai_requests_total[5m])

# Error rate
rate(ai_requests_total{status="error"}[5m]) / rate(ai_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(ai_request_latency_bucket[5m]))

# Token usage per hour
increase(ai_tokens_total[1h])

# Cost per day
sum(increase(ai_tokens_total{type="input"}[24h])) * 0.000003 +
sum(increase(ai_tokens_total{type="output"}[24h])) * 0.000015
```

## PII Considerations

**Never log:**
- Full prompts with user data
- Personally identifiable information
- API keys or secrets

**Always redact:**

```typescript
function redactForLogging(message: string): string {
  return message
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{16}\b/g, '[CARD]')
    .replace(/Bearer [A-Za-z0-9-_.]+/g, 'Bearer [TOKEN]');
}

// Log redacted version only
console.log({ prompt: redactForLogging(prompt) });
```

## Tools

| Tool | Type | Best For |
|------|------|----------|
| LangSmith | Commercial | LangChain projects |
| Helicone | Commercial | Provider-agnostic proxy |
| OpenTelemetry | Open Source | Custom observability |
| Grafana + Loki | Open Source | Log aggregation |
| Weights & Biases | Commercial | ML experiment tracking |
