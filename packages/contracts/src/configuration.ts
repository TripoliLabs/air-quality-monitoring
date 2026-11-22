import { DOWNLINK_LIMITS, type DownlinkCommand, DownlinkOpcode } from '@aq/telemetry-codec';
import { z } from 'zod';

const limits = DOWNLINK_LIMITS;
const representable = (value: number, scale: number): boolean => {
  const scaled = value * scale;
  return (
    Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8
  );
};

export const ConfigurationCommandSchema = z.discriminatedUnion('command', [
  z.strictObject({
    command: z.literal('setInterval'),
    seconds: z.number().int().min(limits.intervalMinS).max(limits.intervalMaxS),
  }),
  z.strictObject({
    command: z.literal('setPmOffset'),
    pmOffset: z
      .number()
      .min(-limits.pmOffsetMaxX10 / 10)
      .max(limits.pmOffsetMaxX10 / 10)
      .refine((n) => representable(n, 10), 'Must be representable in tenths'),
  }),
  z.strictObject({
    command: z.literal('setTempOffset'),
    temperatureOffset: z
      .number()
      .min(-limits.tempOffsetMaxX100 / 100)
      .max(limits.tempOffsetMaxX100 / 100)
      .refine((n) => representable(n, 100), 'Must be representable in hundredths'),
  }),
]);
export type ConfigurationCommand = z.infer<typeof ConfigurationCommandSchema>;

export function configurationWireCommand(command: ConfigurationCommand): DownlinkCommand {
  switch (command.command) {
    case 'setInterval':
      return command;
    case 'setPmOffset':
      return { command: command.command, offsetX10: Math.round(command.pmOffset * 10) };
    case 'setTempOffset':
      return { command: command.command, offsetX100: Math.round(command.temperatureOffset * 100) };
  }
}

export function configurationTarget(command: ConfigurationCommand): {
  opcode: number;
  value: number;
} {
  const wire = configurationWireCommand(command);
  switch (wire.command) {
    case 'setInterval':
      return { opcode: DownlinkOpcode.SetInterval, value: wire.seconds };
    case 'setPmOffset':
      return { opcode: DownlinkOpcode.SetPmOffset, value: wire.offsetX10 };
    case 'setTempOffset':
      return { opcode: DownlinkOpcode.SetTempOffset, value: wire.offsetX100 };
  }
}

export const ConfigDeviceIdSchema = z.string().regex(/^[0-9a-f]{16}$/);
// ChirpStack v4 application IDs are UUIDs, not human-readable application names.
export const ApplicationIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform((id) => id.toLowerCase());

export const ReportedConfigurationSchema = z.strictObject({
  deviceId: ConfigDeviceIdSchema,
  // Wire bounds deliberately differ from outbound hardware guard rails.
  intervalS: z.number().int().min(0).max(65535),
  pmOffset: z
    .number()
    .min(-3276.8)
    .max(3276.7)
    .refine((n) => representable(n, 10)),
  temperatureOffset: z
    .number()
    .min(-327.68)
    .max(327.67)
    .refine((n) => representable(n, 100)),
  lastCommand: z.number().int().min(0).max(255),
  lastResult: z.enum(['none', 'applied', 'out_of_range', 'malformed']),
  reportedAt: z.iso.datetime(),
});
export type ReportedConfiguration = z.infer<typeof ReportedConfigurationSchema>;

export const ConfigurationTrackingSchema = z.strictObject({
  commandId: z.uuid(),
  deviceId: ConfigDeviceIdSchema,
  command: ConfigurationCommandSchema,
  opcode: z.number().int().min(1).max(3),
  wireValue: z.number().int(),
  queuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: z.enum(['queued', 'dispatched', 'applied', 'rejected', 'failed', 'timed_out']),
  attempts: z.number().int().nonnegative(),
  lastAttemptAt: z.iso.datetime().optional(),
  dispatchedAt: z.iso.datetime().optional(),
  completedAt: z.iso.datetime().optional(),
  failure: z.string().optional(),
});
export type ConfigurationTracking = z.infer<typeof ConfigurationTrackingSchema>;

export const ConfigurationStateSchema = z.strictObject({
  reported: ReportedConfigurationSchema.nullable(),
  outstanding: ConfigurationTrackingSchema.nullable(),
  latestResult: ConfigurationTrackingSchema.nullable(),
});
export type ConfigurationState = z.infer<typeof ConfigurationStateSchema>;
export const ConfigurationAcceptedSchema = ConfigurationStateSchema.extend({ commandId: z.uuid() });
export type ConfigurationAccepted = z.infer<typeof ConfigurationAcceptedSchema>;

export const ConfigurationJobSchema = z
  .strictObject({
    version: z.literal(1),
    commandId: z.uuid(),
    deviceId: ConfigDeviceIdSchema,
    command: ConfigurationCommandSchema,
    queuedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .refine(
    (job) => Date.parse(job.expiresAt) > Date.parse(job.queuedAt),
    'Deadline must follow enqueue time',
  );
export type ConfigurationJob = z.infer<typeof ConfigurationJobSchema>;
