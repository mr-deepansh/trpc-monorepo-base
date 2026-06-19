export function getLiveness() {
  return {
    status: "UP",
    timestamp: new Date().toISOString(),
  };
}
