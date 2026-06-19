import type { Request, Response, NextFunction } from "express";
import express from "express";
import {
  logger,
  requestContextMiddleware,
  httpLogger,
  errorHandler,
} from "@repo/logger";
import cors from "cors";
import * as trpcExpress from "@trpc/server/adapters/express";
import {
  generateOpenApiDocument,
  createOpenApiExpressMiddleware,
} from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";
import { serverRouter, createContext } from "@repo/trpc/server";
import { registry, getHealth } from "@repo/observability";
import { env } from "./env";

export const app = express();

const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: "trpcProject OpenAPI",
  version: "1.0.0",
  baseUrl: `${env.BASE_URL}/api`,
});

/**
 * Bearer-token guard for the /metrics endpoint.
 * Protects Prometheus metrics from unauthenticated access.
 */
function metricsAuth(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers["authorization"] ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (provided !== expectedToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? true
        : env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true,
  }),
);

app.use(requestContextMiddleware());
app.use(httpLogger());
app.use(express.json({ limit: "1mb" }));

// ─── Routes ────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ message: "trpcProject is up and running..." });
});

app.get("/health", async (_req, res) => {
  res.json(await getHealth());
});

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

if (env.NODE_ENV !== "test") {
  app.get(
    "/metrics",
    metricsAuth(env.METRICS_TOKEN),
    async (_req, res) => {
      res.set("Content-Type", registry.contentType);
      res.end(await registry.metrics());
    },
  );
}

app.use("/docs", apiReference({ url: "/openapi.json" }));

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

// ─── 404 ───────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error handler (must be last) ──────────────────────────────────────────

app.use(errorHandler);

// ─── Debug helpers ─────────────────────────────────────────────────────────

export function logServerUrls() {
  logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
  logger.debug(`docs:         ${env.BASE_URL}/docs`);
  logger.debug(`metrics:      ${env.BASE_URL}/metrics  (Bearer token required)`);
}

export default app;
