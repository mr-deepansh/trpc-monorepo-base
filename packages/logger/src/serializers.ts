import { randomUUID } from "crypto";
import { runWithContext } from "./context";
import { logger } from "./logger";

export interface RequestContextInput {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
}

export async function withRequestContext<T>(
  input: RequestContextInput,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const requestId = input.requestId ?? randomUUID();
  return runWithContext(
    {
      requestId,
      correlationId: input.correlationId,
      traceId: input.traceId,
      userId: input.userId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
    },
    async () => {
      try {
        const result = await fn();
        logger.debug(
          {
            durationMs: Date.now() - startedAt,
          },
          "Request completed",
        );
        return result;
      } catch (error) {
        logger.error(
          {
            err: error,
            durationMs: Date.now() - startedAt,
          },
          "Request failed",
        );
        throw error;
      }
    },
  );
}
