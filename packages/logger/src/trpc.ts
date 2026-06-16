import { logger } from "./logger";

export async function logProcedure<T>(
  path: string,
  type: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.info(
      { path, type, durationMs: Date.now() - startedAt, success: true },
      "Procedure completed",
    );
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTrpcClientError = isTRPCClientError(error);
    if (isTrpcClientError) {
      logger.warn({ path, type, durationMs, success: false, err: error }, "Procedure client error");
    } else {
      logger.error({ path, type, durationMs, success: false, err: error }, "Procedure failed");
    }
    throw error;
  }
}

// Detect tRPC client errors (4xx) without importing the whole @trpc/server
function isTRPCClientError(error: unknown): boolean {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const clientCodes = new Set([
      "BAD_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "METHOD_NOT_SUPPORTED",
      "TIMEOUT",
      "CONFLICT",
      "PRECONDITION_FAILED",
      "PAYLOAD_TOO_LARGE",
      "UNPROCESSABLE_CONTENT",
      "TOO_MANY_REQUESTS",
      "CLIENT_CLOSED_REQUEST",
    ]);
    return clientCodes.has((error as { code: string }).code);
  }
  return false;
}
