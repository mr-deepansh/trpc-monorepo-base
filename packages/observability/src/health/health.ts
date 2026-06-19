import { getLiveness } from "./liveness";
import { getReadiness } from "./readiness";

export async function getHealth() {
  return {
    liveness: getLiveness(),
    readiness: await getReadiness(),
  };
}
