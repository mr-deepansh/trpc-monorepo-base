import { env } from "./env";

let sdkStarted = false;

export async function initOtel(): Promise<void> {
  if (!env.OTEL_ENABLED || sdkStarted) {
    return;
  }
  sdkStarted = true;
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });
  await sdk.start();
  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch {
      // ignore shutdown errors
    }
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export function getTraceContext(): {
  traceId?: string;
  spanId?: string;
} {
  if (!env.OTEL_ENABLED) {
    return {};
  }
  try {
    const { trace } = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
    const span = trace.getActiveSpan();
    if (!span) {
      return {};
    }
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  } catch {
    return {};
  }
}
