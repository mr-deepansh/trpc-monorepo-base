import { initTRPC } from "@trpc/server";
import { OpenApiMeta } from "trpc-to-openapi";
import { logProcedure, runWithContext } from "@repo/logger";
import type { Context } from "./context";

export const tRPCContext = initTRPC.meta<OpenApiMeta>().context<Context>().create({});

export const router = tRPCContext.router;

const loggerMiddleware = tRPCContext.middleware(({ path, type, ctx, next }) => {
  return runWithContext(
    {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
    },
    () => logProcedure(path, type, () => next()),
  );
});

export const publicProcedure = tRPCContext.procedure.use(loggerMiddleware);
