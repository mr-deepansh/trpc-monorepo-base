import { Counter } from "prom-client";
import { registry } from "./registry";

export const loginAttempts = new Counter({
  name: "auth_login_attempts_total",
  help: "Login attempts",
  registers: [registry],
});

export const loginFailures = new Counter({
  name: "auth_login_failures_total",
  help: "Login failures",
  registers: [registry],
});
