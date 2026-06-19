import http from "node:http";

import { logger } from "@repo/logger";
import { initOtel } from "@repo/observability";

import { app as expressApplication, logServerUrls } from "./server";
import { env } from "./env";

const PORT = env.PORT;

const server = http.createServer(expressApplication);

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown started");

  const forceShutdown = setTimeout(() => {
    logger.error("Force shutdown");
    process.exit(1);
  }, 10000);

  server.close((err) => {
    clearTimeout(forceShutdown);

    if (err) {
      logger.error({ err }, "Server close failed");
      process.exit(1);
    }

    logger.info("HTTP server closed");
    process.exit(0);
  });
}

async function bootstrap() {
  try {
    await initOtel();
    server.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          env: env.NODE_ENV,
        },
        "HTTP server started",
      );
      logServerUrls();
    });
  } catch (err) {
    logger.error({ err }, "Bootstrap failed");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void bootstrap();
