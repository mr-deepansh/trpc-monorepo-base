//  Supported log levels.
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

//  Request and trace context stored in AsyncLocalStorage.
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
//  Service metadata attached to logs.

export interface ServiceContext {
  service: string;
  version?: string;
  environment?: string;
}

//  Event metadata for Kafka, NATS, RabbitMQ, etc.

export interface EventLog {
  eventId: string;
  eventType: string;
  topic: string;
  partition?: number;
  offset?: number;
  correlationId?: string;
}
//  Sanitized HTTP request log.

export interface HttpRequestLog {
  id?: string;
  method: string;
  // Query params are removed before logging.
  url: string;
  userAgent?: string;
  // Never store real IP addresses.
  ip?: string;
}
// HTTP response metadata.
export interface HttpResponseLog {
  statusCode: number;

  contentLength?: number | string;
}
// Performance and latency metrics.
export interface PerformanceLog {
  durationMs: number;
  dbDurationMs?: number;
  cacheHit?: boolean;
}
// Structured error payload.
export interface ErrorLog {
  errorType: string;

  message: string;

  code?: string;

  stack?: string;
}
// Common fields shared by all logs.
export interface BaseLog {
  timestamp?: string;
  level?: LogLevel;
  service?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}
