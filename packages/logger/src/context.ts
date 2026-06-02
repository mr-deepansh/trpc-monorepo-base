import { LogContext } from "./types";
import { AsyncLocalStorage } from "async_hooks";

const als = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getContext(): LogContext {
  return als.getStore() ?? {};
}

export function setContext(patch: Partial<LogContext>): void {
  const store = als.getStore();
  if (store) Object.assign(store, patch);
}
