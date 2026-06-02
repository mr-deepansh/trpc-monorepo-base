import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const envSchema = z.object({
  // Runtime environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_ENV: z.enum(["local", "development", "staging", "production"]).default("local"),

  // Logger settings
  LOGGER_NAME: z.string().default("app-logger"),
  LOGGER_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("json"),
  LOG_REDACT_KEYS: z
    .string()
    .default(
      "req.headers.authorization,req.headers.cookie,req.headers.x-api-key,*.password,*.token,*.secret,*.accessToken,*.refreshToken,*.creditCard,*.ssn",
    ),

  // Service metadata
  SERVICE_NAME: z.string().default("logger-service"),
  SERVICE_NAMESPACE: z.string().default("core"),
  SERVICE_INSTANCE_ID: z.string().default("local"),
  SERVICE_VERSION: z.string().default("1.0.0"),

  // Infrastructure metadata
  HOSTNAME: z.string().default("localhost"),
  POD_NAME: z.string().default("local"),
  AWS_REGION: z.string().optional(),

  // Build and deployment metadata
  COMMIT_SHA: z.string().default("dev"),
  DEPLOYMENT_ID: z.string().default("local"),

  // Request correlation headers
  REQUEST_ID_HEADER: z.string().default("x-request-id"),
  TRACE_ID_HEADER: z.string().default("x-trace-id"),

  // OpenTelemetry settings
  OTEL_ENABLED: booleanString,
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318/v1/traces"),
  OTEL_SAMPLING_RATIO: z.coerce.number().min(0).max(1).default(1),

  // Sentry settings
  SENTRY_ENABLED: booleanString,
  SENTRY_DSN: z
    .string()
    .refine((v) => v === "" || /^https?:\/\//.test(v), "SENTRY_DSN must be empty or a valid URL")
    .default(""),
});

export type Env = z.infer<typeof envSchema>;

function createEnv(env: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error(
      "Invalid environment variables:\n",
      JSON.stringify(result.error.format(), null, 2),
    );
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const env = createEnv(process.env);
