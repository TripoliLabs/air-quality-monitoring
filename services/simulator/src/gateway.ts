import dgram from 'node:dgram';

const PROTO_VERSION = 0x02;
const PUSH_DATA = 0x00;
const PULL_DATA = 0x02;
const PULL_RESP = 0x03;
const TX_ACK = 0x05;

/**
 * A simulated LoRaWAN gateway speaking the Semtech UDP packet-forwarder protocol
 * (the same protocol a Dragino DLOS8N uses with the ChirpStack Gateway Bridge).
 *
 * - Uplinks: PUSH_DATA with a JSON `rxpk`.
 * - Downlinks: it sends periodic PULL_DATA to keep the route open, and receives
 *   PULL_RESP (e.g. a Join Accept) which it surfaces via waitForDownlink().
 */
export class SemtechGateway {
  private readonly sock = dgram.createSocket('udp4');
  private readonly euiBytes: Buffer;
  private pullTimer?: ReturnType<typeof setInterval>;
  private downlinkWaiters: Array<(phy: Buffer) => void> = [];
  private dataDownlinkHandler?: (phy: Buffer) => void;

  constructor(
    private readonly host: string,
    private readonly port: number,
    gatewayEui: string,
  ) {
    this.euiBytes = Buffer.from(gatewayEui, 'hex');
    this.sock.on('message', (msg) => this.onMessage(msg));
  }

  /** Start the downlink keep-alive (PULL_DATA every 10s + once now). */
  start(): void {
    this.sendPullData();
    this.pullTimer = setInterval(() => this.sendPullData(), 10_000);
  }

  private header(packetType: number): Buffer {
    const h = Buffer.alloc(12);
    h[0] = PROTO_VERSION;
    h.writeUInt16BE(Math.floor(Math.random() * 0xffff), 1); // random token
    h[3] = packetType;
    this.euiBytes.copy(h, 4);
    return h;
  }

  private sendPullData(): void {
    this.sock.send(this.header(PULL_DATA), this.port, this.host);
  }

  /** Forward one uplink PHYPayload as a PUSH_DATA datagram. */
  uplink(phyPayload: Buffer, rssi: number, snr: number): void {
    const rxpk = {
      rxpk: [
        {
          tmst: (Date.now() * 1000) >>> 0,
          time: new Date().toISOString(),
          chan: 0,
          rfch: 0,
          freq: 868.1,
          stat: 1,
          modu: 'LORA',
          datr: 'SF7BW125',
          codr: '4/5',
          rssi: Math.round(rssi),
          lsnr: Number(snr.toFixed(1)),
          size: phyPayload.length,
          data: phyPayload.toString('base64'),
        },
      ],
    };
    const datagram = Buffer.concat([
      this.header(PUSH_DATA),
      Buffer.from(JSON.stringify(rxpk), 'utf8'),
    ]);
    this.sock.send(datagram, this.port, this.host);
  }

  /** Handle downlinks that arrive outside a join (e.g. config data downlinks). */
  onDataDownlink(cb: (phy: Buffer) => void): void {
    this.dataDownlinkHandler = cb;
  }

  /** Resolve with the next downlink PHYPayload (e.g. a Join Accept). */
  waitForDownlink(timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const waiter = (phy: Buffer): void => {
        clearTimeout(timer);
        resolve(phy);
      };
      const timer = setTimeout(() => {
        this.downlinkWaiters = this.downlinkWaiters.filter((w) => w !== waiter);
        reject(new Error('downlink timeout'));
      }, timeoutMs);
      this.downlinkWaiters.push(waiter);
    });
  }

  private onMessage(msg: Buffer): void {
    if (msg.length < 4) return;
    if (msg[3] === PULL_RESP) {
      try {
        const json = JSON.parse(msg.subarray(4).toString('utf8')) as { txpk?: { data?: string } };
        const data = json.txpk?.data;
        if (data) {
          const phy = Buffer.from(data, 'base64');
          // A pending waiter means we're mid-join (Join Accept); otherwise it's
          // an application downlink (e.g. a config command) during streaming.
          const waiter = this.downlinkWaiters.shift();
          if (waiter) waiter(phy);
          else this.dataDownlinkHandler?.(phy);
        }
      } catch {
        // ignore malformed PULL_RESP
      }
      // Acknowledge the downlink (TX_ACK echoes the PULL_RESP token).
      const ack = Buffer.alloc(4);
      ack[0] = PROTO_VERSION;
      msg.copy(ack, 1, 1, 3);
      ack[3] = TX_ACK;
      this.sock.send(ack, this.port, this.host);
    }
  }

  close(): void {
    if (this.pullTimer) clearInterval(this.pullTimer);
    this.sock.close();
  }
}
