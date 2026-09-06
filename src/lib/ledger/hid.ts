import type { Apdu, ApduSender } from './apdu';

export const LEDGER_VENDOR_ID = 0x2c97;
export const PACKET_SIZE = 64;
export const CHANNEL = 0x0101;
export const TAG_APDU = 0x05;
export const STATUS_OK = 0x9000;

export function encodeApdu(apdu: Apdu): Uint8Array {
  const out = new Uint8Array(5 + apdu.data.length);
  out.set([apdu.cla, apdu.ins, apdu.p1, apdu.p2, apdu.data.length], 0);
  out.set(apdu.data, 5);
  return out;
}

export function framePackets(payload: Uint8Array, channel = CHANNEL): Uint8Array[] {
  const packets: Uint8Array[] = [];
  let offset = 0;
  let sequence = 0;

  do {
    const packet = new Uint8Array(PACKET_SIZE);
    const view = new DataView(packet.buffer);
    view.setUint16(0, channel, false);
    packet[2] = TAG_APDU;
    view.setUint16(3, sequence, false);
    let header = 5;
    if (sequence === 0) {
      view.setUint16(header, payload.length, false);
      header += 2;
    }
    const size = Math.min(PACKET_SIZE - header, payload.length - offset);
    packet.set(payload.subarray(offset, offset + size), header);
    packets.push(packet);
    offset += size;
    sequence += 1;
  } while (offset < payload.length);

  return packets;
}

export class ResponseAssembler {
  private readonly chunks: Uint8Array[] = [];
  private expected = -1;
  private received = 0;
  private sequence = 0;

  constructor(private readonly channel = CHANNEL) {}

  push(packet: Uint8Array): Uint8Array | null {
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    if (packet.length < 5) throw new Error('short_packet');
    if (view.getUint16(0, false) !== this.channel) return null;
    if (packet[2] !== TAG_APDU) return null;
    if (view.getUint16(3, false) !== this.sequence) throw new Error('out_of_order_packet');

    let header = 5;
    if (this.sequence === 0) {
      this.expected = view.getUint16(header, false);
      header += 2;
    }
    this.sequence += 1;

    const size = Math.min(PACKET_SIZE - header, this.expected - this.received);
    this.chunks.push(packet.slice(header, header + size));
    this.received += size;
    if (this.received < this.expected) return null;

    const message = new Uint8Array(this.expected);
    let offset = 0;
    for (const chunk of this.chunks) {
      message.set(chunk, offset);
      offset += chunk.length;
    }
    return message;
  }
}

export function readStatus(message: Uint8Array): Uint8Array {
  if (message.length < 2) throw new Error('short_response');
  const status = (message[message.length - 2]! << 8) | message[message.length - 1]!;
  if (status !== STATUS_OK) throw new Error(`ledger_status:${status.toString(16)}`);
  return message.subarray(0, message.length - 2);
}

export interface HidLike {
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: Uint8Array): Promise<void>;
  addEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
}

export class WebHidSender implements ApduSender {
  constructor(
    private readonly device: HidLike,
    private readonly channel = CHANNEL,
  ) {}

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close();
  }

  async send(apdu: Apdu): Promise<Uint8Array> {
    if (!this.device.opened) await this.device.open();
    const assembler = new ResponseAssembler(this.channel);

    const response = new Promise<Uint8Array>((resolve, reject) => {
      const listener = (event: HIDInputReportEvent) => {
        try {
          const packet = new Uint8Array(event.data.buffer, event.data.byteOffset, PACKET_SIZE);
          const message = assembler.push(packet);
          if (!message) return;
          this.device.removeEventListener('inputreport', listener);
          resolve(readStatus(message));
        } catch (error) {
          this.device.removeEventListener('inputreport', listener);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      this.device.addEventListener('inputreport', listener);
    });

    for (const packet of framePackets(encodeApdu(apdu), this.channel)) {
      await this.device.sendReport(0, packet);
    }

    return response;
  }
}

export function hidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

export async function requestLedger(): Promise<WebHidSender | null> {
  if (!hidSupported()) throw new Error('hid_unsupported');
  const [device] = await navigator.hid.requestDevice({
    filters: [{ vendorId: LEDGER_VENDOR_ID }],
  });
  return device ? new WebHidSender(device) : null;
}

export async function pairedLedger(): Promise<WebHidSender | null> {
  if (!hidSupported()) return null;
  const devices = await navigator.hid.getDevices();
  const device = devices.find((entry) => entry.vendorId === LEDGER_VENDOR_ID);
  return device ? new WebHidSender(device) : null;
}
