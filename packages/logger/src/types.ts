// ============================================================================
// LOGGING CORE TYPES
// ============================================================================

/**
 * Supported logger severity levels.
 *
 * WHY:
 * - Matches common structured logging systems.
 * - `silent` disables log emission without changing call sites.
 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/**
 * Distributed tracing and request-scoped context.
 *
 * WHY:
 * - Propagated through AsyncLocalStorage.
 * - Enables correlation across services, queues and databases.
 * - Every request should have at least a requestId.
 */
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

/**
 * Immutable service metadata attached to every log entry.
 *
 * WHY:
 * - Required for multi-service environments.
 * - Allows filtering by service, version and deployment environment.
 */
export interface ServiceContext {
  service: string;
  version?: string;
  environment?: string;
}

/**
 * Event bus metadata.
 *
 * Used for:
 * - Kafka
 * - RabbitMQ
 * - NATS
 * - SQS
 * - Other asynchronous messaging systems
 *
 * WHY:
 * Enables event lineage and message traceability.
 */
export interface EventLog {
  eventId: string;
  eventType: string;
  topic: string;
  partition?: number;
  offset?: number;
  correlationId?: string;
}

/**
 * Sanitized HTTP request metadata.
 *
 * SECURITY:
 * - Query parameters must never be logged.
 * - Sensitive headers must be redacted upstream.
 * - IP addresses should always be masked or removed.
 */
export interface HttpRequestLog {
  id?: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
}

/**
 * HTTP response metadata.
 *
 * WHY:
 * Enables latency, throughput and status-code monitoring.
 */
export interface HttpResponseLog {
  statusCode: number;
  contentLength?: number | string;
}

/**
 * Performance metrics attached to a log event.
 *
 * PERF:
 * Used for identifying slow requests,
 * database bottlenecks and cache effectiveness.
 */
export interface PerformanceLog {
  durationMs: number;
  dbDurationMs?: number;
  cacheHit?: boolean;
}

/**
 * Structured error payload.
 *
 * WHY:
 * Errors must be machine-readable for alerting,
 * dashboards and incident investigations.
 */
export interface ErrorLog {
  type: string;
  message: string;
  code?: string;
  stack?: string;
}

/**
 * Common fields shared by all log records.
 *
 * ARCH:
 * Acts as the foundational contract for every
 * structured log emitted by the application.
 */
export interface BaseLog {
  timestamp?: string;
  level?: LogLevel;
  service?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}

