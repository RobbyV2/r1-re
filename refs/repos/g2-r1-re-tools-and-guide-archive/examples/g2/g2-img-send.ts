#!/usr/bin/env bun
// G2 EvenHub image synthesizer.
//
// Connects to both arms, runs the prelude (sid=01 type=2 app-launch +
// sid=e0 type=0 CreateStartUpPageContainer), then sends one or more
// ImageRawDataUpdate messages built from arbitrary pixel buffers.
//
// Goal: experiment with MapFragmentPacketSize (option 2) and validate
// fully-synthetic image content end-to-end.
//
// Usage:
//   bun g2-img-send.ts                      # send default 4-image gradient sweep
//   bun g2-img-send.ts --frag-size N        # bytes per app-level fragment (default 4096)
//   bun g2-img-send.ts --image gradient     # gradient | checker | solid | random | captured
//   bun g2-img-send.ts --count N            # number of images to push (default 4)
//   bun g2-img-send.ts --width W --height H # image dimensions (default 288×144)
//   bun g2-img-send.ts --bpp N              # 4 (default) — only 4bpp accepted by firmware
//   bun g2-img-send.ts --no-prelude         # skip prelude (assume already primed)

import noble from "@stoprocent/noble";
import type { Peripheral, Characteristic } from "@stoprocent/noble";

const NAME_RE = /(?:even\s+)?G\d+_(\d+)_([LR])_/i;
const WRITE_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5401".toLowerCase();
const NOTIFY_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5402".toLowerCase();

const fullUuid = (uuid: string) => {
  const s = uuid.toLowerCase().replace(/-/g, "");
  return s.length === 32
    ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
    : s;
};

const ts = () => {
  const t = new Date();
  return `${t.toISOString().slice(11, 19)}.${String(t.getMilliseconds()).padStart(3, "0")}`;
};

// --- Protocol primitives ---------------------------------------------------

function crc16CCittFalse(data: Uint8Array, start: number, end: number): number {
  let crc = 0xffff;
  for (let i = start; i < end; i++) {
    crc ^= data[i]! << 8;
    for (let k = 0; k < 8; k++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function encodeVarint(v: number): number[] {
  const out: number[] = [];
  let x = v >>> 0;
  while (x >= 0x80) {
    out.push((x & 0x7f) | 0x80);
    x >>>= 7;
  }
  out.push(x);
  return out;
}

function pbVarintField(field: number, value: number): number[] {
  const tag = (field << 3) | 0;
  return [tag, ...encodeVarint(value)];
}

function pbBytesField(field: number, bytes: Uint8Array | number[]): number[] {
  const tag = (field << 3) | 2;
  const arr = Array.from(bytes);
  return [tag, ...encodeVarint(arr.length), ...arr];
}

function pbStringField(field: number, s: string): number[] {
  return pbBytesField(field, Array.from(new TextEncoder().encode(s)));
}

// Build the inner ImageRawDataUpdate message body.
// Field order matches Mirai capture: ContainerID, ContainerName, MapSessionId,
// MapTotalSize, MapFragmentIndex, MapFragmentPacketSize, MapRawData.
// CompressMode (field 5) is omitted (defaults to 0 = no compression).
function buildImageRawDataUpdate(opts: {
  containerID: number;
  containerName: string;
  mapSessionId: number;
  mapTotalSize: number;
  mapFragmentIndex: number;
  mapFragmentPacketSize: number;
  mapRawData: Uint8Array;
}): Uint8Array {
  const out: number[] = [];
  out.push(...pbVarintField(1, opts.containerID));
  out.push(...pbStringField(2, opts.containerName));
  out.push(...pbVarintField(3, opts.mapSessionId));
  out.push(...pbVarintField(4, opts.mapTotalSize));
  out.push(...pbVarintField(6, opts.mapFragmentIndex));
  out.push(...pbVarintField(7, opts.mapFragmentPacketSize));
  out.push(...pbBytesField(8, opts.mapRawData));
  return new Uint8Array(out);
}

// Wrap an inner ImageRawDataUpdate in an evenhub_main_msg_ctx with
// Cmd=APP_UPDATE_IMAGE_RAW_DATA_PACKET (3) and a unique MagicRandom.
function buildOuterImagePacket(magic: number, inner: Uint8Array): Uint8Array {
  const out: number[] = [];
  out.push(...pbVarintField(1, 3)); // Cmd = APP_UPDATE_IMAGE_RAW_DATA_PACKET
  out.push(...pbVarintField(2, magic)); // MagicRandom
  out.push(...pbBytesField(5, inner)); // ImgRawMsg
  return new Uint8Array(out);
}

// Build a CreateContainer (Cmd=7) message for an image container.
// From capture f20342/f21506: outer f1=7, f2=magic, f7=CreateMsg
// CreateMsg: f1 varint 1, f4 bytes=CreateInner
// CreateInner: f1=x, f2=y, f3=width, f4=height, f5=type(1=image), f6=name
function buildCreateImageContainer(
  magic: number,
  name: string,
  width: number,
  height: number,
): Uint8Array {
  const inner: number[] = [];
  inner.push(...pbVarintField(1, 0)); // x
  inner.push(...pbVarintField(2, 0)); // y
  inner.push(...pbVarintField(3, width));
  inner.push(...pbVarintField(4, height));
  inner.push(...pbVarintField(5, 1)); // type = 1 (image/raw container)
  inner.push(...pbStringField(6, name));

  const createMsg: number[] = [];
  createMsg.push(...pbVarintField(1, 1)); // field 1 varint 1
  createMsg.push(...pbBytesField(4, inner)); // field 4 = CreateInner bytes

  const outer: number[] = [];
  outer.push(...pbVarintField(1, 7)); // Cmd = CREATE_CONTAINER (or similar)
  outer.push(...pbVarintField(2, magic));
  outer.push(...pbBytesField(7, createMsg));
  return new Uint8Array(outer);
}

// Fragment a protobuf payload across BLE frames using the EvenHub envelope.
// Envelope: aa 21 transportSeq lenByte totFrags fragIdx sid flag <pb chunk>
// Final fragment carries CRC-16/CCITT-FALSE over the concatenated pb payloads
// of all fragments in its last 2 bytes (little-endian).
//
// Per-frame bytes-after-envelope (lenByte) cap is 255. We use a chunk size of
// 232 to match Mirai's frame size (240 BLE bytes total) on non-last frags.
function buildBleFrames(
  pbPayload: Uint8Array,
  transportSeq: number,
  sid: number,
  flag: number,
  chunkSize = 232,
): Uint8Array[] {
  // CRC over the entire concatenated pb payload, appended to the last frag.
  const crc = crc16CCittFalse(pbPayload, 0, pbPayload.length);
  const crcBytes = new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]);

  // Tail bytes that need to live in the final frame's pb region.
  // Multi-frag: last frag carries (residual pb bytes) + 2 crc bytes.
  // Single-frag: pb + 2 crc bytes.
  const totalBytesIncludingCrc = pbPayload.length + 2;

  // How many frames? Each non-last frag carries up to chunkSize bytes of pb.
  // Last frag carries the remainder + 2 CRC bytes, which must also fit in 255.
  const totalFrags = Math.ceil(totalBytesIncludingCrc / chunkSize);
  if (totalFrags > 255) {
    throw new Error(`buildBleFrames: ${totalFrags} fragments exceeds byte field`);
  }

  const frames: Uint8Array[] = [];
  let pbOffset = 0;
  for (let i = 0; i < totalFrags; i++) {
    const fragIdx = i + 1; // capture uses 1-based
    const isLast = i === totalFrags - 1;
    let payloadChunk: Uint8Array;
    if (isLast) {
      // Whatever pb remains plus the 2 CRC bytes.
      const remaining = pbPayload.subarray(pbOffset);
      payloadChunk = new Uint8Array(remaining.length + 2);
      payloadChunk.set(remaining, 0);
      payloadChunk.set(crcBytes, remaining.length);
      pbOffset += remaining.length;
    } else {
      payloadChunk = pbPayload.subarray(pbOffset, pbOffset + chunkSize);
      pbOffset += chunkSize;
    }
    if (payloadChunk.length > 255) {
      throw new Error(
        `buildBleFrames: chunk ${i} is ${payloadChunk.length}B > 255 (envelope len byte)`,
      );
    }
    const frame = new Uint8Array(8 + payloadChunk.length);
    frame[0] = 0xaa;
    frame[1] = 0x21;
    frame[2] = transportSeq & 0xff;
    frame[3] = payloadChunk.length;
    frame[4] = totalFrags;
    frame[5] = fragIdx;
    frame[6] = sid;
    frame[7] = flag;
    frame.set(payloadChunk, 8);
    frames.push(frame);
  }
  return frames;
}

// --- Image content generators ---------------------------------------------

// 4bpp BMP: 14B file + 40B DIB + 64B palette + pixel data.
// Palette: i*17 grayscale ramp (matches Mirai).
// Pixel rows are bottom-up; row stride = ceil(width/2) padded to multiple of 4.
function buildBmp4bpp(width: number, height: number, pixelFn: (x: number, y: number) => number): Uint8Array {
  const rowBytesUnpadded = Math.ceil(width / 2);
  const rowStride = (rowBytesUnpadded + 3) & ~3; // 4-byte alignment
  const pixelSize = rowStride * height;
  const headerSize = 14 + 40 + 64;
  const total = headerSize + pixelSize;
  const buf = new Uint8Array(total);

  // BMP file header (14 bytes)
  buf[0] = 0x42; buf[1] = 0x4d; // "BM"
  const sz32 = (n: number, off: number) => {
    buf[off] = n & 0xff; buf[off + 1] = (n >> 8) & 0xff;
    buf[off + 2] = (n >> 16) & 0xff; buf[off + 3] = (n >> 24) & 0xff;
  };
  sz32(total, 2);
  sz32(0, 6); // reserved
  sz32(headerSize, 10); // pixel data offset

  // DIB header (40 bytes BITMAPINFOHEADER)
  sz32(40, 14);
  sz32(width, 18);
  sz32(height, 22);
  buf[26] = 1; buf[27] = 0; // planes
  buf[28] = 4; buf[29] = 0; // bpp = 4
  sz32(0, 30); // compression = BI_RGB
  sz32(pixelSize, 34);
  sz32(0, 38); sz32(0, 42); // x/y resolution
  sz32(16, 46); // colors used
  sz32(0, 50); // important colors

  // Palette: 16 entries × 4 bytes (BGRA), grayscale ramp i*17
  for (let i = 0; i < 16; i++) {
    const v = (i * 17) & 0xff;
    const off = 54 + i * 4;
    buf[off] = v; buf[off + 1] = v; buf[off + 2] = v; buf[off + 3] = 0;
  }

  // Pixel data, bottom-up
  for (let y = 0; y < height; y++) {
    const rowStart = headerSize + (height - 1 - y) * rowStride;
    for (let x = 0; x < width; x += 2) {
      const hi = pixelFn(x, y) & 0xf;
      const lo = pixelFn(x + 1, y) & 0xf;
      buf[rowStart + (x >> 1)] = (hi << 4) | lo;
    }
  }
  return buf;
}

const PIXEL_FNS: Record<string, (w: number, h: number) => Uint8Array> = {
  gradient: (w, h) =>
    buildBmp4bpp(w, h, (x, _y) => Math.floor((x / w) * 16)),
  vgradient: (w, h) =>
    buildBmp4bpp(w, h, (_x, y) => Math.floor((y / h) * 16)),
  checker: (w, h) =>
    buildBmp4bpp(w, h, (x, y) => (((x >> 4) ^ (y >> 4)) & 1) ? 15 : 0),
  solid: (w, h) =>
    buildBmp4bpp(w, h, () => 15),
  black: (w, h) =>
    buildBmp4bpp(w, h, () => 0),
  random: (w, h) =>
    buildBmp4bpp(w, h, () => Math.floor(Math.random() * 16)),
  diagonal: (w, h) =>
    buildBmp4bpp(w, h, (x, y) => ((x + y) >> 3) & 15),
  radial: (w, h) =>
    buildBmp4bpp(w, h, (x, y) => {
      const dx = x - w / 2, dy = y - h / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.floor(d / Math.max(w, h) * 32) & 15;
    }),
};

// --- BLE plumbing ----------------------------------------------------------

interface ArmHandles {
  slot: "A" | "B";
  side: "L" | "R";
  peripheral: Peripheral;
  write: Characteristic;
  notify: Characteristic;
  waiters: Map<string, (frame: Uint8Array) => void>;
}

interface Parsed {
  ok: boolean;
  sid?: number;
  flag?: number;
  msgType?: number;
  msgSeq?: number;
}

function varintRead(buf: Uint8Array, off: number): [number, number] {
  let v = 0, s = 0, i = off;
  while (i < buf.length) {
    const b = buf[i]!;
    v |= (b & 0x7f) << s;
    i++;
    if ((b & 0x80) === 0) return [v, i];
    s += 7;
  }
  return [v, i];
}

function parseRxFrame(bytes: Uint8Array): Parsed {
  if (bytes.length < 10) return { ok: false };
  if (bytes[0] !== 0xaa) return { ok: false };
  if (bytes[1] !== 0x12 && bytes[1] !== 0x21) return { ok: false };
  const sid = bytes[6]!;
  const flag = bytes[7]!;
  let msgType = -1, msgSeq = -1;
  let off = 8;
  for (let k = 0; k < 8 && off < bytes.length; k++) {
    const key = bytes[off]!;
    off++;
    const tag = key >> 3;
    const wire = key & 7;
    if (wire === 0) {
      const [v, n] = varintRead(bytes, off);
      if (tag === 1) msgType = v;
      else if (tag === 2) msgSeq = v;
      off = n;
    } else if (wire === 2) {
      const [lenB, n] = varintRead(bytes, off);
      off = n + lenB;
    } else break;
    if (msgType !== -1 && msgSeq !== -1) break;
  }
  return { ok: true, sid, flag, msgType, msgSeq };
}

async function findBothArms(timeoutMs = 90_000): Promise<{ L: Peripheral; R: Peripheral }> {
  return new Promise(async (resolve, reject) => {
    const seen = new Map<string, Peripheral>();
    const onDiscover = (p: Peripheral) => {
      const m = NAME_RE.exec(p.advertisement.localName || "");
      if (!m) return;
      const side = m[2]!.toUpperCase() as "L" | "R";
      if (!seen.has(side)) {
        console.log(`[${ts()}] saw ${side}: ${p.advertisement.localName}`);
        seen.set(side, p);
      }
      if (seen.has("L") && seen.has("R")) {
        noble.off("discover", onDiscover);
        noble.stopScanningAsync().then(() =>
          resolve({ L: seen.get("L")!, R: seen.get("R")! }),
        );
      }
    };
    noble.on("discover", onDiscover);
    await noble.startScanningAsync([], true);
    setTimeout(() => {
      noble.off("discover", onDiscover);
      noble.stopScanningAsync().then(() => {
        if (seen.size < 2) reject(new Error(`only found ${[...seen.keys()].join(",") || "none"}`));
        else resolve({ L: seen.get("L")!, R: seen.get("R")! });
      });
    }, timeoutMs);
  });
}

async function connectArm(p: Peripheral, slot: "A" | "B", side: "L" | "R"): Promise<ArmHandles> {
  await p.connectAsync();
  const { characteristics } = await p.discoverAllServicesAndCharacteristicsAsync();
  const write = characteristics.find((c) => fullUuid(c.uuid) === WRITE_CHAR);
  const notify = characteristics.find((c) => fullUuid(c.uuid) === NOTIFY_CHAR);
  if (!write || !notify) throw new Error(`${slot}/${side}: chars missing`);
  const waiters = new Map<string, (f: Uint8Array) => void>();
  const arm: ArmHandles = { slot, side, peripheral: p, write, notify, waiters };
  notify.on("data", (data: Buffer) => {
    const frame = new Uint8Array(data);
    const parsed = parseRxFrame(frame);
    if (parsed.ok && parsed.msgSeq !== undefined && parsed.msgSeq >= 0) {
      const key = `${parsed.sid}:${parsed.msgSeq}`;
      const w = waiters.get(key);
      if (w) {
        waiters.delete(key);
        w(frame);
      }
    }
    console.log(
      `[${ts()}] ${slot}/${side} RX (${data.length}B) sid=${parsed.sid?.toString(16).padStart(2, "0")} type=${parsed.msgType} seq=${parsed.msgSeq} hex=${data.toString("hex")}`,
    );
  });
  await notify.subscribeAsync();
  // Bump max-listeners to avoid noble's per-write disconnect listener leak.
  // @ts-ignore — internal field; safer than awaiting listener leak warnings.
  const inner = (p as any)._noble;
  if (inner && typeof inner.setMaxListeners === "function") {
    inner.setMaxListeners(2000);
  }
  return arm;
}

function waitForAck(arm: ArmHandles, sid: number, msgSeq: number, timeoutMs: number) {
  return new Promise<Uint8Array | null>((resolve) => {
    const key = `${sid}:${msgSeq}`;
    const t = setTimeout(() => {
      arm.waiters.delete(key);
      resolve(null);
    }, timeoutMs);
    arm.waiters.set(key, (f) => {
      clearTimeout(t);
      resolve(f);
    });
  });
}

async function sendFrames(arm: ArmHandles, frames: Uint8Array[]): Promise<void> {
  for (const f of frames) {
    await arm.write.writeAsync(Buffer.from(f), true);
  }
}

// --- Prelude --------------------------------------------------------------

// Captured prelude frame f5872 (sid=01 type=2 app-launch).
// Bytes verified against the working --window 5872-5883 replay.
const PRELUDE_F5872 = new Uint8Array([
  0xaa, 0x21, 0x92, 0x13, 0x01, 0x01, 0x01, 0x20, 0x08, 0x02, 0x10, 0x9c,
  0x01, 0x22, 0x0a, 0x1a, 0x08, 0x12, 0x06, 0x12, 0x04, 0x08, 0x00, 0x10,
  0x00, 0xa1, 0x42,
]);

// Captured prelude frame f5883 (sid=e0 type=0 CreateStartUpPageContainer)
// for widget cmux-img. Loaded lazily from the TSV at runtime so we don't
// hand-paste a long byte sequence — it's the one frame from the capture
// that primes the image session.
async function loadF5883FromCapture(): Promise<Uint8Array> {
  // Path to your own captured btsnoop TSV. Set G2_CAPTURE_TSV to override.
  const tsv = process.env.G2_CAPTURE_TSV || "./captures/app_session.tsv";
  const text = await Bun.file(tsv).text();
  for (const line of text.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 5) continue;
    if (parts[0] === "5883") {
      const hex = parts[4]!.toLowerCase().replace(/[^0-9a-f]/g, "");
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
  }
  throw new Error("f5883 not found in capture TSV");
}

async function runPrelude(
  arm: ArmHandles,
  containerName: string,
  width: number,
  height: number,
): Promise<void> {
  console.log(`[${ts()}] prelude: sending f5872 (sid=01 type=2 app-launch)`);
  // sid=01 is strict — wait for ack.
  const ack1 = waitForAck(arm, 0x01, 156, 5000);
  await arm.write.writeAsync(Buffer.from(PRELUDE_F5872), true);
  const r1 = await ack1;
  if (!r1) throw new Error("prelude f5872 ack timeout");

  const f5883 = await loadF5883FromCapture();
  console.log(`[${ts()}] prelude: sending f5883 (sid=e0 type=0 CreateStartUpPageContainer for cmux-list)`);
  const ack2 = waitForAck(arm, 0xe0, 157, 3000);
  await arm.write.writeAsync(Buffer.from(f5883), true);
  await ack2;

  // Create the actual image container — this was missing. The capture shows
  // Cmd=7 CreateImageContainer messages preceded every image send at f20342/f21506.
  const createMagic = 158;
  console.log(`[${ts()}] prelude: creating image container "${containerName}" ${width}×${height} (Cmd=7 magic=${createMagic})`);
  const createPb = buildCreateImageContainer(createMagic, containerName, width, height);
  const createFrames = buildBleFrames(createPb, 0x10, 0xe0, 0x20);
  const ack3 = waitForAck(arm, 0xe0, createMagic, 3000);
  await sendFrames(arm, createFrames);
  const r3 = await ack3;
  if (!r3) {
    console.warn(`[${ts()}] prelude: CreateContainer ack timeout (continuing anyway)`);
  } else {
    console.log(`[${ts()}] prelude: CreateContainer acked (${r3.length}B)`);
  }
}

// --- Sending images --------------------------------------------------------

interface SendImageOpts {
  arm: ArmHandles;
  bmp: Uint8Array;
  fragSize: number; // app-level MapFragmentPacketSize (NOT the BLE chunk size)
  containerName: string;
  containerID: number;
  sessionId: number;
  baseMagic: number; // protobuf MagicRandom for first message; +1 per frag
  baseTransportSeq: number; // transport seq byte; +1 per BLE frame
  dispatchMode?: "serial" | "intraBurst" | "window"; // default serial
  windowSize?: number; // for mode=window: max in-flight frags
}

async function sendImage(opts: SendImageOpts): Promise<{
  fragments: number;
  totalBleFrames: number;
  totalBytes: number;
  results: Array<{ ok: boolean; errorCode?: number; magic: number; ms: number }>;
}> {
  const { arm, bmp, fragSize, containerName, containerID, sessionId, dispatchMode = "serial", windowSize = 2 } = opts;
  let { baseMagic, baseTransportSeq } = opts;
  const fragments = Math.ceil(bmp.length / fragSize);
  let totalBleFrames = 0;
  const results: { ok: boolean; errorCode?: number; magic: number; ms: number }[] = [];

  // Pre-build all fragment frames + magics.
  type FragPlan = { magic: number; frames: Uint8Array[]; index: number };
  const plans: FragPlan[] = [];
  for (let i = 0; i < fragments; i++) {
    const start = i * fragSize;
    const end = Math.min(start + fragSize, bmp.length);
    const slice = bmp.subarray(start, end);
    const inner = buildImageRawDataUpdate({
      containerID,
      containerName,
      mapSessionId: sessionId,
      mapTotalSize: bmp.length,
      mapFragmentIndex: i,
      mapFragmentPacketSize: slice.length,
      mapRawData: slice,
    });
    const magic = baseMagic++;
    const outer = buildOuterImagePacket(magic, inner);
    const frames = buildBleFrames(outer, baseTransportSeq, 0xe0, 0x20);
    baseTransportSeq = (baseTransportSeq + frames.length) & 0xff;
    totalBleFrames += frames.length;
    plans.push({ magic, frames, index: i });
  }

  if (dispatchMode === "intraBurst") {
    // Install all ack waiters upfront, dispatch all fragments back-to-back,
    // then wait for all acks collectively. Matches Mirai's ~720ms/image cadence.
    console.log(`[${ts()}] img dispatchMode=intraBurst: ${fragments} frags queued`);
    const ackPromises: Promise<Uint8Array | null>[] = plans.map((p) =>
      waitForAck(arm, 0xe0, p.magic, 15000),
    );
    const t0 = performance.now();
    for (const p of plans) {
      await sendFrames(arm, p.frames); // still awaited per-frame (BLE stack is fast)
    }
    const acks = await Promise.all(ackPromises);
    const totalMs = performance.now() - t0;
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i]!;
      const ack = acks[i];
      if (!ack) {
        console.warn(`[${ts()}]   frag ${p.index + 1}: ack TIMEOUT`);
        results.push({ ok: false, magic: p.magic, ms: totalMs });
        continue;
      }
      let errorCode = -1;
      for (let k = 0; k < ack.length - 1; k++) {
        if (ack[k] === 0x40) { errorCode = ack[k + 1]!; break; }
      }
      const ok = errorCode === 4;
      results.push({ ok, errorCode, magic: p.magic, ms: totalMs });
      console.log(`[${ts()}]   frag ${p.index + 1}: ErrorCode=${errorCode} ${ok ? "OK" : "FAIL"}`);
    }
    console.log(`[${ts()}] img intraBurst total: ${totalMs.toFixed(0)}ms`);
  } else if (dispatchMode === "window") {
    // Sliding window: keep at most `windowSize` fragments in-flight. When
    // window is full, wait for the oldest ack before dispatching the next.
    console.log(`[${ts()}] img dispatchMode=window size=${windowSize}: ${fragments} frags`);
    const inflight: { plan: FragPlan; p: Promise<{ p: FragPlan; ack: Uint8Array | null }> }[] = [];
    const t0 = performance.now();
    const drainOne = async () => {
      const first = inflight.shift()!;
      const { p, ack } = await first.p;
      if (!ack) {
        console.warn(`[${ts()}]   frag ${p.index + 1}: ack TIMEOUT`);
        results.push({ ok: false, magic: p.magic, ms: performance.now() - t0 });
        return false;
      }
      let errorCode = -1;
      for (let k = 0; k < ack.length - 1; k++) {
        if (ack[k] === 0x40) { errorCode = ack[k + 1]!; break; }
      }
      const ok = errorCode === 4;
      results.push({ ok, errorCode, magic: p.magic, ms: performance.now() - t0 });
      console.log(`[${ts()}]   frag ${p.index + 1}: ErrorCode=${errorCode} ${ok ? "OK" : "FAIL"}`);
      return ok;
    };
    for (const p of plans) {
      while (inflight.length >= windowSize) {
        const ok = await drainOne();
        if (!ok) {
          // drain remaining without sending more
          while (inflight.length > 0) await drainOne();
          break;
        }
      }
      const ackP = waitForAck(arm, 0xe0, p.magic, 15000);
      const wrapped = ackP.then((ack) => ({ p, ack }));
      inflight.push({ plan: p, p: wrapped });
      await sendFrames(arm, p.frames);
    }
    while (inflight.length > 0) await drainOne();
    console.log(`[${ts()}] img window total: ${(performance.now() - t0).toFixed(0)}ms`);
  } else {
    // Serial: await each fragment's ack before sending the next.
    for (const p of plans) {
      console.log(
        `[${ts()}] img frag ${p.index + 1}/${fragments}: ${p.frames.length} BLE frames, magic=${p.magic}`,
      );
      const ackP = waitForAck(arm, 0xe0, p.magic, 15000);
      const t0 = performance.now();
      await sendFrames(arm, p.frames);
      const ack = await ackP;
      const ms = performance.now() - t0;
      if (!ack) {
        console.warn(`[${ts()}]   ack TIMEOUT after ${ms.toFixed(0)}ms`);
        results.push({ ok: false, magic: p.magic, ms });
        continue;
      }
      let errorCode = -1;
      for (let k = 0; k < ack.length - 1; k++) {
        if (ack[k] === 0x40) { errorCode = ack[k + 1]!; break; }
      }
      const ok = errorCode === 4;
      console.log(
        `[${ts()}]   ack ${ms.toFixed(0)}ms ErrorCode=${errorCode} ${ok ? "SUCCESS" : "FAIL"}`,
      );
      results.push({ ok, errorCode, magic: p.magic, ms });
    }
  }

  return { fragments, totalBleFrames, totalBytes: bmp.length, results };
}

// --- Main ------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        argMap[a.slice(2)] = next;
        i++;
      } else {
        argMap[a.slice(2)] = "true";
      }
    }
  }

  const fragSize = parseInt(argMap["frag-size"] || "4096", 10);
  const imageType = argMap["image"] || "gradient";
  const count = parseInt(argMap["count"] || "4", 10);
  const width = parseInt(argMap["width"] || "288", 10);
  const height = parseInt(argMap["height"] || "144", 10);
  const skipPrelude = argMap["no-prelude"] === "true";
  const sessionIdBase = parseInt(argMap["session-id"] || "1000", 10);
  const swap = argMap["swap"] === "true";
  const modeArg = argMap["mode"] || "serial";
  const dispatchMode: "serial" | "intraBurst" | "window" =
    modeArg === "intraBurst" || modeArg === "window" ? modeArg : "serial";
  const windowSize = parseInt(argMap["window"] || "2", 10);
  const interImageMs = parseInt(argMap["delay"] || "0", 10);

  console.log(
    `[${ts()}] g2-img-send: image=${imageType} ${width}×${height}, count=${count}, fragSize=${fragSize}`,
  );

  if (noble.state !== "poweredOn") await noble.waitForPoweredOnAsync(6000);

  console.log(`[${ts()}] scanning for both arms...`);
  const { L, R } = await findBothArms();
  console.log(`[${ts()}] connecting...`);
  const slotA = swap ? L : R;
  const slotB = swap ? R : L;
  const sideA = swap ? "L" : "R";
  const sideB = swap ? "R" : "L";
  const armA = await connectArm(slotA, "A", sideA);
  const armB = await connectArm(slotB, "B", sideB);
  console.log(`[${ts()}] both arms connected. Settling 1.0s...`);
  await new Promise((r) => setTimeout(r, 1000));

  if (!skipPrelude) {
    try {
      await runPrelude(armA, "cmux-img", width, height);
    } catch (e: any) {
      console.error(`[${ts()}] prelude failed: ${e.message}`);
      process.exit(1);
    }
  }

  // Generator
  const fn = PIXEL_FNS[imageType];
  if (!fn) {
    console.error(`unknown --image: ${imageType}. options: ${Object.keys(PIXEL_FNS).join(", ")}`);
    process.exit(1);
  }

  const allResults: { fragments: number; totalBleFrames: number; totalBytes: number; ms: number; ok: boolean }[] = [];
  let baseMagic = 200; // start above the prelude's seq
  let baseTransportSeq = 0x30; // above prelude's 0x10 create frame

  for (let i = 0; i < count; i++) {
    // Generate a new image (slight per-iteration variation)
    const bmp = fn(width, height);
    const t0 = performance.now();
    const r = await sendImage({
      arm: armA,
      bmp,
      fragSize,
      containerName: "cmux-img",
      containerID: 1,
      sessionId: sessionIdBase + i,
      baseMagic,
      baseTransportSeq,
      dispatchMode,
      windowSize,
    });
    const ms = performance.now() - t0;
    const ok = r.results.every((x) => x.ok);
    allResults.push({ fragments: r.fragments, totalBleFrames: r.totalBleFrames, totalBytes: r.totalBytes, ms, ok });
    baseMagic += r.fragments;
    baseTransportSeq = (baseTransportSeq + r.totalBleFrames) & 0xff;
    console.log(
      `[${ts()}] image ${i + 1}/${count}: ${r.fragments} frags, ${r.totalBleFrames} BLE frames, ${r.totalBytes}B in ${ms.toFixed(0)}ms (${ok ? "OK" : "FAIL"})`,
    );
    if (!ok) {
      console.warn(`[${ts()}] aborting after failure`);
      break;
    }
    if (interImageMs > 0 && i < count - 1) {
      await new Promise((r) => setTimeout(r, interImageMs));
    }
  }

  // Summary
  console.log(`\n[${ts()}] === summary ===`);
  for (const [i, r] of allResults.entries()) {
    console.log(
      `  img ${i + 1}: frags=${r.fragments} bleFrames=${r.totalBleFrames} bytes=${r.totalBytes} ${r.ms.toFixed(0)}ms ${r.ok ? "OK" : "FAIL"}`,
    );
  }
  if (allResults.length > 0) {
    const okOnly = allResults.filter((r) => r.ok);
    if (okOnly.length > 0) {
      const totalMs = okOnly.reduce((s, r) => s + r.ms, 0);
      const totalBytes = okOnly.reduce((s, r) => s + r.totalBytes, 0);
      console.log(
        `  avg: ${(totalMs / okOnly.length).toFixed(0)}ms/image, throughput=${(totalBytes / totalMs).toFixed(2)} KB/s`,
      );
    }
  }

  console.log(`[${ts()}] holding 2s then disconnect.`);
  await new Promise((r) => setTimeout(r, 2000));
  await armA.peripheral.disconnectAsync().catch(() => {});
  await armB.peripheral.disconnectAsync().catch(() => {});
  console.log(`[${ts()}] done`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`error: ${e?.message || e}`);
  process.exit(1);
});
