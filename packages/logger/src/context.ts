import { LogContext } from "./types";
import { AsyncLocalStorage } from "async_hooks";

const als = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getContext(): Readonly<LogContext> {
  return als.getStore() ?? {};
}

export function setContext(patch: Partial<LogContext>): void {
  const store = als.getStore();
  if (!store) {
    if (process.env["NODE_ENV"] !== "production") {
      console.warn("[logger/context] setContext() called outside runWithContext — patch dropped");
    }
    return;
  }
  Object.assign(store, patch);
}
