// packages/observability/src/otel/otel.ts

import { env } from "./env";

let sdkInitPromise: Promise<void> | null = null;

export async function initOtel(): Promise<void> {
  if (!env.OTEL_ENABLED) {
    return;
  }
  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  sdkInitPromise = (async () => {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } =
      await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import(
      "@opentelemetry/exporter-trace-otlp-http"
    );
    const { Resource } = await import("@opentelemetry/resources");
    // Use stable attribute names (SEMRESATTRS_* are deprecated since v1.0)
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
      "@opentelemetry/semantic-conventions"
    );

    const sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: env.SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: env.SERVICE_VERSION,
      }),
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
      } catch (error) {
        console.error("Error shutting down OpenTelemetry SDK:", error);
      }
    };

    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  })();

  return sdkInitPromise;
}

export function getTraceContext(): {
  traceId?: string;
  spanId?: string;
} {
  if (!env.OTEL_ENABLED) {
    return {};
  }
  try {
    // Use dynamic import-style require to stay compatible with CJS/ESM interop.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trace } = require("@opentelemetry/api") as typeof import("@opentelemetry/api");
    const span = trace.getActiveSpan();
    if (!span) {
      return {};
    }
    const { traceId, spanId } = span.spanContext();
    return { traceId, spanId };
  } catch {
    return {};
  }
}
