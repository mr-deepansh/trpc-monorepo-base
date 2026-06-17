import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const envSchema = z.object({
  OTEL_ENABLED: booleanString,
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318/v1/traces"),
  SERVICE_NAME: z.string().default("observability-service"),
  SERVICE_VERSION: z.string().default("1.0.0"),
});

export const env = envSchema.parse(process.env);
