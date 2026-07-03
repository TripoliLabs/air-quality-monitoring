import crypto from 'node:crypto';
import {
  decrypt,
  decryptJoinAccept,
  fromFields,
  fromWire,
  generateSessionKeys10,
  recalculateMIC,
} from 'lora-packet';

/** Derived session keys for a joined device (the result of an OTAA join). */
export interface DeviceSession {
  devEui: string;
  devAddr: string; // 8 hex chars (4 bytes)
  nwkSKey: string; // 32 hex chars
  appSKey: string; // 32 hex chars
}

/** Root credentials provisioned in ChirpStack (OTAA). */
export interface DeviceCredentials {
  devEui: string;
  joinEui: string; // 16 hex chars (JoinEUI / AppEUI)
  appKey: string; // 32 hex chars (root key)
}

export function newDevNonce(): Buffer {
  return crypto.randomBytes(2);
}

/**
 * Build a LoRaWAN 1.0.x OTAA Join Request and sign its MIC with the root AppKey —
 * the first step of the join handshake the ESP32's LoRaWAN stack performs.
 */
export function buildJoinRequest(cred: DeviceCredentials, devNonce: Buffer): Buffer {
  const appKey = Buffer.from(cred.appKey, 'hex');
  const packet = fromFields({
    MType: 'Join Request',
    AppEUI: Buffer.from(cred.joinEui, 'hex'),
    DevEUI: Buffer.from(cred.devEui, 'hex'),
    DevNonce: devNonce,
  });
  recalculateMIC(packet, appKey, appKey); // join MIC uses the AppKey (3rd arg)
  return packet.getPHYPayload();
}

/**
 * Process the Join Accept downlink: decrypt it with the AppKey and derive the
 * session keys (NwkSKey + AppSKey) — exactly what the device does after a join.
 */
export function deriveSession(
  cred: DeviceCredentials,
  devNonce: Buffer,
  joinAcceptPhy: Buffer,
): DeviceSession {
  const appKey = Buffer.from(cred.appKey, 'hex');
  const received = fromWire(joinAcceptPhy);
  const accept = fromWire(decryptJoinAccept(received, appKey));
  const b = accept.getBuffers();
  const keys = generateSessionKeys10(appKey, b.NetID, b.AppNonce, devNonce);
  return {
    devEui: cred.devEui,
    devAddr: b.DevAddr.toString('hex'),
    nwkSKey: keys.NwkSKey.toString('hex'),
    appSKey: keys.AppSKey.toString('hex'),
  };
}

/**
 * Build a "Unconfirmed Data Up" frame (fPort 2) with the session keys — the
 * device MAC encrypts the FRMPayload with AppSKey and computes the MIC with
 * NwkSKey. Returns the raw PHYPayload bytes.
 */
/** The DevAddr (hex) a downlink PHYPayload is addressed to. */
export function downlinkDevAddr(phy: Buffer): string {
  return fromWire(phy).getBuffers().DevAddr.toString('hex');
}

/** The FPort of a downlink, or undefined for a MAC-only frame (no app payload). */
export function downlinkFPort(phy: Buffer): number | undefined {
  const fport = fromWire(phy).getBuffers().FPort;
  return fport && fport.length > 0 ? fport[0] : undefined;
}

/** Decrypt a downlink data frame's FRMPayload with the device's session keys. */
export function decryptDownlink(session: DeviceSession, phy: Buffer): Buffer {
  const packet = fromWire(phy);
  return decrypt(packet, Buffer.from(session.appSKey, 'hex'), Buffer.from(session.nwkSKey, 'hex'));
}

export function buildUplink(session: DeviceSession, fCnt: number, frmPayload: Buffer): Buffer {
  const packet = fromFields(
    {
      MType: 'Unconfirmed Data Up',
      DevAddr: Buffer.from(session.devAddr, 'hex'),
      FCtrl: { ADR: false, ACK: false, ADRACKReq: false, FPending: false },
      FCnt: fCnt,
      FPort: 2,
      payload: frmPayload,
    },
    Buffer.from(session.appSKey, 'hex'),
    Buffer.from(session.nwkSKey, 'hex'),
  );
  return packet.getPHYPayload();
}
