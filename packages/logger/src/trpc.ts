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
      {
        path,
        type,
        durationMs: Date.now() - startedAt,
      },
      "Procedure completed",
    );
    return result;
  } catch (error) {
    logger.error(
      {
        err: error,
        path,
        type,
        durationMs: Date.now() - startedAt,
      },
      "Procedure failed",
    );
    throw error;
  }
}
