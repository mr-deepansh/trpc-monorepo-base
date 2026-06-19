import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  logger.error(
    {
      err,
      route: req.originalUrl,
    },
    "Unhandled error",
  );

  res.status(500).json({
    success: false,
  });
}
