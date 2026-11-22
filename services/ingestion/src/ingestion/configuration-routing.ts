import { ApplicationIdSchema, type ChirpStackUplink, ConfigDeviceIdSchema } from '@aq/contracts';

export function configurationRoute(
  topic: string,
  uplink: ChirpStackUplink,
): {
  deviceId: string;
  applicationId: string;
} {
  const match = /^application\/([^/]+)\/device\/([^/]+)\/event\/up$/.exec(topic);
  if (!match) throw new Error('Invalid application uplink topic');
  const deviceId = ConfigDeviceIdSchema.parse(uplink.deviceInfo.devEui.toLowerCase());
  const topicDevice = ConfigDeviceIdSchema.parse(match[2].toLowerCase());
  const applicationId = ApplicationIdSchema.parse(match[1]);
  if (
    topicDevice !== deviceId ||
    (uplink.deviceInfo.applicationId !== undefined &&
      ApplicationIdSchema.parse(uplink.deviceInfo.applicationId) !== applicationId)
  ) {
    throw new Error('Uplink topic/envelope routing mismatch');
  }
  return { deviceId, applicationId };
}
