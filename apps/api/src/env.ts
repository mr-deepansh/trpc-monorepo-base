import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BASE_URL: z.string().default("http://localhost:8000"),
  CORS_ORIGINS: z.string().default(""),
  METRICS_TOKEN: z.string().min(16, {
    message:"METRICS_TOKEN must be at least 16 characters",
}),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    console.error("Invalid env:", result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = createEnv(process.env);
