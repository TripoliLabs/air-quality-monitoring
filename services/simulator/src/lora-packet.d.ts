// Minimal ambient types for lora-packet (the package ships no TS types).
declare module 'lora-packet' {
  interface LoraPacket {
    getPHYPayload(): Buffer;
    getBuffers(): Record<string, Buffer>;
    getMType(): string;
  }
  export function fromFields(
    fields: Record<string, unknown>,
    key1?: Buffer,
    key2?: Buffer,
  ): LoraPacket;
  export function fromWire(buf: Buffer): LoraPacket;
  export function recalculateMIC(
    packet: LoraPacket,
    nwkSKey: Buffer,
    appKey?: Buffer,
    fCntMSB?: Buffer,
  ): void;
  export function decryptJoinAccept(packet: LoraPacket, appKey: Buffer): Buffer;
  export function generateSessionKeys10(
    appKey: Buffer,
    netId: Buffer,
    appNonce: Buffer,
    devNonce: Buffer,
  ): { NwkSKey: Buffer; AppSKey: Buffer };
}
