import { logger } from "./logger";

export function logEventPublished(eventType: string, topic: string, eventId: string): void {
  logger.info({ eventType, topic, eventId }, "Event published");
}

export function logEventConsumed(eventType: string, topic: string, eventId: string): void {
  logger.info({ eventType, topic, eventId }, "Event consumed");
}

export function logEventFailed(
  eventType: string,
  topic: string,
  eventId: string,
  error: unknown,
): void {
  logger.error({ eventType, topic, eventId, err: error }, "Event processing failed");
}
