import { Histogram } from "prom-client";
import { registry } from "./registry";

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration",
  labelNames: ["operation"],
  registers: [registry],
});
