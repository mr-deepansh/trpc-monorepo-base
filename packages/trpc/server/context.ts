import { randomUUID } from "crypto";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
// import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createContext(opts: CreateNextContextOptions) {
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
