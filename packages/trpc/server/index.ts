import { router } from "./trpc";
import { healthRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";

const _serverRouter = router({
  health: healthRouter,
  auth: authRouter,
});

export type ServerRouter = typeof _serverRouter;
export const serverRouter: ServerRouter = _serverRouter;

export { createContext } from "./context";
