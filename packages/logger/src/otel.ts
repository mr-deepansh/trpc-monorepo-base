import { env } from "./env";

let sdkStarted = false;
let shutdownFn: (() => Promise<void>) | null = null;

export async function initOtel(): Promise<void> {
  if (!env.OTEL_ENABLED || sdkStarted) {
    return;
  }
  sdkStarted = true;
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const { Resource } = await import("@opentelemetry/resources");
  const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } =
    await import("@opentelemetry/semantic-conventions");

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: env.SERVICE_NAME,
      [SEMRESATTRS_SERVICE_VERSION]: env.SERVICE_VERSION,
    }),
    traceExporter: new OTLPTraceExporter({
      url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });
  await sdk.start();
  shutdownFn = async () => {
    try {
      await sdk.shutdown();
    } catch {}
  };
  process.once("SIGTERM", shutdownFn);
  process.once("SIGINT", shutdownFn);
}

export function getTraceContext(): { traceId?: string; spanId?: string } {
  if (!env.OTEL_ENABLED) {
    return {};
  }
  try {
    const { trace } = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
    const span = trace.getActiveSpan();
    if (!span) return {};
    const { traceId, spanId } = span.spanContext();
    return { traceId, spanId };
  } catch {
    return {};
  }
}
