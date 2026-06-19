import { randomUUID } from "crypto";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

export async function createContext(opts: CreateExpressContextOptions) {
  // Headers can be string | string[] | undefined — always take the first value
  const rawHeader = (key: string): string | undefined => {
    const val = opts.req.headers[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const requestId = rawHeader("x-request-id") ?? randomUUID();
  const correlationId = rawHeader("x-correlation-id");
  const userId = rawHeader("x-user-id");

  return {
    requestId,
    correlationId,
    userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
