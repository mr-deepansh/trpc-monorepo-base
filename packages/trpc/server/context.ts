import { randomUUID } from "crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export async function createContext(opts: CreateExpressContextOptions) {
  const requestId = (opts.req.headers["x-request-id"] as string) ?? randomUUID();
  const correlationId = opts.req.headers["x-correlation-id"] as string | undefined;
  const userId = opts.req.headers["x-user-id"] as string | undefined;
  return {
    requestId,
    correlationId,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
