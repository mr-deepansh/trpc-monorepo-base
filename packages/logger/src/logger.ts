import pino, { type Logger } from "pino";
import { env } from "./env";
import { serializers } from "./serializers";
import { getContext } from "./context";
import { getTraceContext } from "@repo/observability";
import { REDACT_PATHS } from "./redact";

// Pretty logs when LOG_FORMAT=pretty, JSON otherwise
function buildTransport() {
  if (env.LOG_FORMAT !== "pretty") return undefined;
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
    namespace: env.SERVICE_NAMESPACE,
    instanceId: env.SERVICE_INSTANCE_ID,
    hostname: env.HOSTNAME,
    pod: env.POD_NAME,
    commitSha: env.COMMIT_SHA,
    ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
  },
  // Use ISO timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers,
  redact: {
    paths: REDACT_PATHS as string[],
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
