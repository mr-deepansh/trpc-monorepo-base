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

function createEnv(env: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error(
      "[@repo/observability] Invalid environment variables:\n",
      JSON.stringify(result.error.format(), null, 2),
    );
    throw new Error("[@repo/observability] Invalid environment variables — see stderr for details");
  }
  return result.data;
}

export const env = createEnv(process.env);
