import { z } from 'zod';
import { ReadingResponseSchema } from './sensor';

/** Real-time event broadcast over Redis Pub/Sub → WebSocket when a reading lands. */
export const ReadingCreatedEventSchema = z.object({
  type: z.literal('reading.created'),
  payload: ReadingResponseSchema,
});
export type ReadingCreatedEvent = z.infer<typeof ReadingCreatedEventSchema>;

/** Device online/offline status change. */
export const DeviceStatusEventSchema = z.object({
  type: z.literal('device.status'),
  payload: z.object({
    deviceId: z.string(),
    online: z.boolean(),
    lastSeenAt: z.iso.datetime(),
  }),
});
export type DeviceStatusEvent = z.infer<typeof DeviceStatusEventSchema>;

export const AppEventSchema = z.discriminatedUnion('type', [
  ReadingCreatedEventSchema,
  DeviceStatusEventSchema,
]);
export type AppEvent = z.infer<typeof AppEventSchema>;

/**
 * ChirpStack v4 application uplink event (JSON integration). Only the fields the
 * ingestion pipeline needs are modelled; unknown fields are ignored.
 */
export const ChirpStackUplinkSchema = z.object({
  deviceInfo: z.object({
    devEui: z.string(),
    deviceName: z.string().optional(),
    applicationId: z.string().optional(),
  }),
  fPort: z.number().int().optional(),
  fCnt: z.number().int().optional(),
  /** base64-encoded frmPayload (the raw LoRa application bytes). */
  data: z.string(),
  time: z.iso.datetime().optional(),
  rxInfo: z
    .array(
      z.object({
        gatewayId: z.string().optional(),
        rssi: z.number().optional(),
        snr: z.number().optional(),
      }),
    )
    .optional(),
});
export type ChirpStackUplink = z.infer<typeof ChirpStackUplinkSchema>;
