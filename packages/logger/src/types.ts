/** Supported log levels. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/** Request and trace context stored in AsyncLocalStorage. */
export interface LogContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
}

/** Service metadata attached to every log line. */
export interface ServiceContext {
  service: string;
  version?: string;
  environment?: string;
}

/** Event metadata for Kafka, NATS, RabbitMQ, etc. */
export interface EventLog {
  eventId: string;
  eventType: string;
  topic: string;
  partition?: number;
  offset?: number;
  correlationId?: string;
}

/** Sanitized HTTP request log — query params are stripped, IP is always redacted. */
export interface HttpRequestLog {
  id?: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
}

/** HTTP response metadata. */
export interface HttpResponseLog {
  statusCode: number;
  contentLength?: number | string;
}

/** Performance and latency metrics. */
export interface PerformanceLog {
  durationMs: number;
  dbDurationMs?: number;
  cacheHit?: boolean;
}

/**
 * Structured error payload.
 *
 * FIXED: original file had `errorType` here but `serializers.ts` produced `type`.
 * Unified to `type` to match the pino `err` serializer output and avoid
 * silent field-mismatch bugs in consumers.
 */
export interface ErrorLog {
  type: string;
  message: string;
  code?: string;
  stack?: string;
}

/** Common fields shared by all log lines. */
export interface BaseLog {
  timestamp?: string;
  level?: LogLevel;
  service?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}
