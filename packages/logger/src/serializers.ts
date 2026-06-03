import type { IncomingMessage, ServerResponse } from "http";
import type { ErrorLog, HttpRequestLog, HttpResponseLog } from "./types";

export const serializers = {
  req(req: IncomingMessage & { id?: string }): HttpRequestLog {
    const rawUrl = req.url ?? "/";
    const url = rawUrl.includes("?") ? rawUrl.slice(0, rawUrl.indexOf("?")) : rawUrl;
    return {
      id: req.id,
      method: req.method ?? "UNKNOWN",
      url,
      userAgent: req.headers["user-agent"],
      ip: "[redacted]",
    };
  },
  res(res: ServerResponse): HttpResponseLog {
    return {
      statusCode: res.statusCode,
      contentLength: res.getHeader("content-length") as string | number | undefined,
    };
  },
  err(err: Error & { code?: string }): ErrorLog {
    return {
      type: err.constructor?.name ?? "Error",
      message: err.message,
      code: err.code,
      stack: process.env["NODE_ENV"] !== "production" ? err.stack : undefined,
    };
  },
};
