import { env } from "./env";

export const REDACT_PATHS = env.LOG_REDACT_KEYS.split(",")
  .map((path) => path.trim())
  .filter(Boolean);
