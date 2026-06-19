import type { Request, Response, NextFunction } from "express";

import { logger } from "./logger";

export function httpLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now();

    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          route: req.originalUrl,
          statusCode: res.statusCode,

          durationMs: Math.round(performance.now() - start),
        },
        "HTTP Request",
      );
    });

    next();
  };
}
