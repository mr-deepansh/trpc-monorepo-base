import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { runWithContext } from "./context";

/**
 * Express middleware that seeds AsyncLocalStorage with per-request context
 * for the lifetime of the entire request/response cycle.
 *
 * IMPORTANT: We use `runWithContext` + synchronous `next()` here — NOT
 * `withRequestContext` which is async and would tear down the ALS store
 * before downstream middleware/routes execute.
 */
export function requestContextMiddleware() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    runWithContext(
      {
        requestId:
          (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
        correlationId:
          (req.headers["x-correlation-id"] as string | undefined) ??
          randomUUID(),
        userId: req.headers["x-user-id"] as string | undefined,
        tenantId: req.headers["x-tenant-id"] as string | undefined,
        sessionId: req.headers["x-session-id"] as string | undefined,
      },
      () => next(),
    );
  };
}
