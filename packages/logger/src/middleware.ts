import { randomUUID } from "crypto";
import { runWithContext } from "./context";
import { logger } from "./logger";

export interface RequestContextInput {
  requestId?: string;
  userId?: string;
  tenantId?: string;
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
      userId: input.userId,
      tenantId: input.tenantId,
    },
    async () => {
      try {
        const result = await fn();
        logger.debug(
          {
            requestId,
            durationMs: Date.now() - startedAt,
          },
          "Request completed",
        );
        return result;
      } catch (error) {
        logger.error(
          {
            requestId,
            durationMs: Date.now() - startedAt,
            err: error,
          },
          "Request failed",
        );

        throw error;
      }
    },
  );
}
