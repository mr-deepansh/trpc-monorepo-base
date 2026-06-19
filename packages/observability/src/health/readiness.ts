import { db } from "@repo/database";

export async function getReadiness() {
  try {
    await db.execute("select 1");
    return {
      ready: true,
    };
  } catch {
    return {
      ready: false,
    };
  }
}
