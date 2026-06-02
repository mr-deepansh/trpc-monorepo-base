import { logger } from "./logger";

export function logEventPublished(eventType: string, topic: string, eventId: string) {
  logger.info(
    {
      eventType,
      topic,
      eventId,
    },
    "Event published",
  );
}

export function logEventConsumed(eventType: string, topic: string, eventId: string) {
  logger.info(
    {
      eventType,
      topic,
      eventId,
    },
    "Event consumed",
  );
}
