import pino, { type Logger } from "pino";
import { env } from "./env";
import { serializers } from "./serializers";
import { getContext } from "./context";
import { getTraceContext } from "./otel";
import { REDACT_PATHS } from "./redact";

const isDev = env.NODE_ENV === "development";

// Pretty logs in development, JSON logs in production
function buildTransport() {
  if (!isDev) return undefined;
  return {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname",
      singleLine: false,
      messageFormat: "{msg}",
      errorLikeObjectKeys: ["err", "error"],
    },
  };
}

export const logger: Logger = pino({
  level: env.LOGGER_LEVEL,
  // Metadata added to every log
  base: {
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
    environment: env.NODE_ENV,
    ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
  },
  // Use ISO timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  // Custom serializers for request, response and error logs
  serializers,
  // Remove sensitive data before logging
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
  // Add request and trace context automatically
  mixin() {
    return {
      ...getContext(),
      ...getTraceContext(),
    };
  },
  // Explicit log fields override context fields
  mixinMergeStrategy(mergeObject, mixinObject) {
    return {
      ...mixinObject,
      ...mergeObject,
    };
  },
  transport: buildTransport(),
});

// Create a logger for a specific subsystem
export function createChildLogger(subsystem: string): Logger {
  return logger.child({ subsystem });
}
