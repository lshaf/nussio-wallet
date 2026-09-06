import { describe, expect, it, vi } from 'vitest';
import { INS_GET_APP_CONFIGURATION, type Apdu } from './apdu';
import {
  CHANNEL,
  PACKET_SIZE,
  ResponseAssembler,
  TAG_APDU,
  WebHidSender,
  encodeApdu,
  framePackets,
  readStatus,
  type HidLike,
} from './hid';

function apdu(data: Uint8Array): Apdu {
  return { cla: 0xd4, ins: INS_GET_APP_CONFIGURATION, p1: 0, p2: 0, data };
}

function reassemble(packets: Uint8Array[]): Uint8Array {
  const assembler = new ResponseAssembler();
  let message: Uint8Array | null = null;
  for (const packet of packets) message = assembler.push(packet) ?? message;
  if (!message) throw new Error('incomplete');
  return message;
}

class FakeDevice implements HidLike {
  opened = false;
  readonly sent: Uint8Array[] = [];
  private listener: ((event: HIDInputReportEvent) => void) | null = null;

  constructor(private readonly reply: (payload: Uint8Array) => Uint8Array) {}

  async open() {
    this.opened = true;
  }

  async close() {
    this.opened = false;
  }

  async sendReport(_reportId: number, data: Uint8Array) {
    this.sent.push(data);
    const total = new DataView(this.sent[0]!.buffer).getUint16(5, false);
    const carried = this.sent.reduce(
      (sum, packet, index) => sum + PACKET_SIZE - (index === 0 ? 7 : 5),
      0,
    );
    if (carried < total) return;
    const request = reassemble(this.sent);
    for (const packet of framePackets(this.reply(request))) {
      this.listener?.({ data: new DataView(packet.buffer) } as HIDInputReportEvent);
    }
  }

  addEventListener(_type: 'inputreport', listener: (event: HIDInputReportEvent) => void) {
    this.listener = listener;
  }

  removeEventListener() {
    this.listener = null;
  }
}

describe('ledger hid framing', () => {
  it('prefixes an apdu with its length byte', () => {
    expect([...encodeApdu(apdu(new Uint8Array([1, 2, 3])))]).toEqual([
      0xd4, 0x06, 0, 0, 3, 1, 2, 3,
    ]);
  });

  it('writes the channel, tag, sequence and total length into the first packet', () => {
    const [first] = framePackets(new Uint8Array([9, 9, 9]));
    const view = new DataView(first!.buffer);
    expect(first).toHaveLength(PACKET_SIZE);
    expect(view.getUint16(0, false)).toBe(CHANNEL);
    expect(first![2]).toBe(TAG_APDU);
    expect(view.getUint16(3, false)).toBe(0);
    expect(view.getUint16(5, false)).toBe(3);
    expect([...first!.subarray(7, 10)]).toEqual([9, 9, 9]);
  });

  it('splits a payload larger than one packet and numbers the continuations', () => {
    const payload = Uint8Array.from({ length: 200 }, (_, index) => index & 0xff);
    const packets = framePackets(payload);
    expect(packets).toHaveLength(4);
    expect(new DataView(packets[1]!.buffer).getUint16(3, false)).toBe(1);
    expect(new DataView(packets[3]!.buffer).getUint16(3, false)).toBe(3);
    expect([...reassemble(packets)]).toEqual([...payload]);
  });

  it('ignores packets from another channel and rejects a gap in the sequence', () => {
    const packets = framePackets(Uint8Array.from({ length: 120 }, () => 7));
    const stranger = packets[0]!.slice();
    new DataView(stranger.buffer).setUint16(0, 0x0202, false);
    const assembler = new ResponseAssembler();
    expect(assembler.push(stranger)).toBeNull();
    expect(assembler.push(packets[0]!)).toBeNull();
    expect(() => assembler.push(packets[0]!)).toThrow('out_of_order_packet');
  });

  it('strips a 9000 status word and throws on anything else', () => {
    expect([...readStatus(new Uint8Array([1, 2, 0x90, 0x00]))]).toEqual([1, 2]);
    expect(() => readStatus(new Uint8Array([0x69, 0x85]))).toThrow('ledger_status:6985');
  });
});

describe('WebHidSender', () => {
  it('opens the device, frames the apdu and resolves with the payload', async () => {
    const device = new FakeDevice(() => new Uint8Array([1, 2, 3, 4, 0x90, 0x00]));
    const sender = new WebHidSender(device);
    const response = await sender.send(apdu(new Uint8Array(0)));
    expect(device.opened).toBe(true);
    expect([...response]).toEqual([1, 2, 3, 4]);
    expect([...reassemble(device.sent)]).toEqual([0xd4, 0x06, 0, 0, 0]);
  });

  it('rejects when the device answers with an error status', async () => {
    const sender = new WebHidSender(new FakeDevice(() => new Uint8Array([0x69, 0x85])));
    await expect(sender.send(apdu(new Uint8Array(0)))).rejects.toThrow('ledger_status:6985');
  });

  it('drops its listener once a response is complete', async () => {
    const device = new FakeDevice(() => new Uint8Array([0x90, 0x00]));
    const remove = vi.spyOn(device, 'removeEventListener');
    await new WebHidSender(device).send(apdu(new Uint8Array(0)));
    expect(remove).toHaveBeenCalled();
  });
});
