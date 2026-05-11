#!/usr/bin/env bun
// G2 EvenHub StartUpPage list/launcher synthesizer.
//
// Pushes a custom launcher menu to a StartUpPageContainer — the same
// container type the Mirai companion app uses for its own launcher. We
// can put whatever items we want.
//
// Usage:
//   bun g2-list-send.ts --name cmux-list --items "❯ ⌘  Home,◆  Tasks,▶  Logs"
//   bun g2-list-send.ts --file menu.txt   # one item per line

import noble from "@stoprocent/noble";
import type { Peripheral, Characteristic } from "@stoprocent/noble";

const NAME_RE = /(?:even\s+)?G\d+_(\d+)_([LR])_/i;
const WRITE_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5401";
const NOTIFY_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5402";

const fullUuid = (u: string) => {
  const s = u.toLowerCase().replace(/-/g, "");
  return s.length === 32
    ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
    : s;
};
const ts = () => {
  const t = new Date();
  return `${t.toISOString().slice(11, 19)}.${String(t.getMilliseconds()).padStart(3, "0")}`;
};

function crc16CCittFalse(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8;
    for (let k = 0; k < 8; k++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function varint(v: number): number[] {
  const out: number[] = [];
  let x = v >>> 0;
  while (x >= 0x80) { out.push((x & 0x7f) | 0x80); x >>>= 7; }
  out.push(x);
  return out;
}
const pbV = (f: number, v: number) => [(f << 3) | 0, ...varint(v)];
const pbB = (f: number, b: Uint8Array | number[]) => {
  const a = Array.from(b);
  return [(f << 3) | 2, ...varint(a.length), ...a];
};
const pbS = (f: number, s: string) => pbB(f, Array.from(new TextEncoder().encode(s)));

// StartUpPage ListContainer inner msg (f11 inside StartUpPageConfig):
//   f1 = item count
//   f4 = repeated string (each item)
function buildListItems(items: string[]): Uint8Array {
  const out: number[] = [];
  out.push(...pbV(1, items.length));
  for (const it of items) out.push(...pbS(4, it));
  return new Uint8Array(out);
}

// StartUpPageConfig (f2 inside CreateStartUpPageContainerMsg):
//   f1 x, f2 y, f3 width, f4 height, f9 flag, f10 name, f11 listItems, f12 flag
function buildStartUpPageConfig(opts: {
  x: number; y: number; width: number; height: number;
  name: string; items: string[];
  f9?: number; f12?: number;
}): Uint8Array {
  const out: number[] = [];
  out.push(...pbV(1, opts.x));
  out.push(...pbV(2, opts.y));
  out.push(...pbV(3, opts.width));
  out.push(...pbV(4, opts.height));
  out.push(...pbV(9, opts.f9 ?? 1));
  out.push(...pbS(10, opts.name));
  out.push(...pbB(11, buildListItems(opts.items)));
  out.push(...pbV(12, opts.f12 ?? 1));
  return new Uint8Array(out);
}

// CreateStartUpPageContainerMsg (f3 inside outer):
//   f1 op(=1), f2 config, f5 ttl(=10000)
function buildCreateMsg(cfg: Uint8Array, f5 = 10000): Uint8Array {
  const out: number[] = [];
  out.push(...pbV(1, 1));
  out.push(...pbB(2, cfg));
  out.push(...pbV(5, f5));
  return new Uint8Array(out);
}

// Outer evenhub_main_msg_ctx: f1=0 (Cmd=CreateStartUpPage), f2=magic, f3=msg
function buildOuter(magic: number, msg: Uint8Array): Uint8Array {
  const out: number[] = [];
  out.push(...pbV(1, 0));
  out.push(...pbV(2, magic));
  out.push(...pbB(3, msg));
  return new Uint8Array(out);
}

function buildBleFrames(pb: Uint8Array, seq: number, sid: number, flag: number, chunkSize = 232): Uint8Array[] {
  const crc = crc16CCittFalse(pb);
  const crcBytes = new Uint8Array([crc & 0xff, (crc >> 8) & 0xff]);
  const totalWithCrc = pb.length + 2;
  const totalFrags = Math.ceil(totalWithCrc / chunkSize);
  const frames: Uint8Array[] = [];
  let off = 0;
  for (let i = 0; i < totalFrags; i++) {
    const isLast = i === totalFrags - 1;
    let chunk: Uint8Array;
    if (isLast) {
      const remain = pb.subarray(off);
      chunk = new Uint8Array(remain.length + 2);
      chunk.set(remain, 0);
      chunk.set(crcBytes, remain.length);
      off += remain.length;
    } else {
      chunk = pb.subarray(off, off + chunkSize);
      off += chunkSize;
    }
    const frame = new Uint8Array(8 + chunk.length);
    frame[0] = 0xaa; frame[1] = 0x21;
    frame[2] = (seq + i) & 0xff;
    frame[3] = chunk.length;
    frame[4] = totalFrags;
    frame[5] = i + 1;
    frame[6] = sid;
    frame[7] = flag;
    frame.set(chunk, 8);
    frames.push(frame);
  }
  return frames;
}

const PRELUDE_F5872 = new Uint8Array([
  0xaa, 0x21, 0x92, 0x13, 0x01, 0x01, 0x01, 0x20, 0x08, 0x02, 0x10, 0x9c,
  0x01, 0x22, 0x0a, 0x1a, 0x08, 0x12, 0x06, 0x12, 0x04, 0x08, 0x00, 0x10,
  0x00, 0xa1, 0x42,
]);

interface ArmHandles {
  peripheral: Peripheral;
  write: Characteristic;
  notify: Characteristic;
  waiters: Map<string, (f: Uint8Array) => void>;
}

function varintRead(b: Uint8Array, o: number): [number, number] {
  let v = 0, s = 0, i = o;
  while (i < b.length) { const c = b[i++]!; v |= (c & 0x7f) << s; if ((c & 0x80) === 0) return [v, i]; s += 7; }
  return [v, i];
}

function parseRxFrame(b: Uint8Array) {
  if (b.length < 10) return { ok: false };
  if (b[0] !== 0xaa) return { ok: false };
  const sid = b[6]!;
  let msgType = -1, msgSeq = -1;
  let off = 8;
  for (let k = 0; k < 8 && off < b.length; k++) {
    const key = b[off++]!;
    const tag = key >> 3, wire = key & 7;
    if (wire === 0) {
      const [v, n] = varintRead(b, off);
      if (tag === 1) msgType = v;
      else if (tag === 2) msgSeq = v;
      off = n;
    } else if (wire === 2) {
      const [lb, n] = varintRead(b, off);
      off = n + lb;
    } else break;
    if (msgType !== -1 && msgSeq !== -1) break;
  }
  return { ok: true, sid, msgType, msgSeq };
}

async function findBothArms(timeoutMs = 90_000): Promise<{ L: Peripheral; R: Peripheral }> {
  return new Promise(async (resolve, reject) => {
    const seen = new Map<string, Peripheral>();
    const onDiscover = (p: Peripheral) => {
      const m = NAME_RE.exec(p.advertisement.localName || "");
      if (!m) return;
      const side = m[2]!.toUpperCase() as "L" | "R";
      if (!seen.has(side)) { console.log(`[${ts()}] saw ${side}`); seen.set(side, p); }
      if (seen.has("L") && seen.has("R")) {
        noble.off("discover", onDiscover);
        noble.stopScanningAsync().then(() => resolve({ L: seen.get("L")!, R: seen.get("R")! }));
      }
    };
    noble.on("discover", onDiscover);
    await noble.startScanningAsync([], true);
    setTimeout(() => {
      noble.off("discover", onDiscover);
      noble.stopScanningAsync().then(() => {
        if (seen.size < 2) reject(new Error("timeout")); else resolve({ L: seen.get("L")!, R: seen.get("R")! });
      });
    }, timeoutMs);
  });
}

async function connectArm(p: Peripheral, label: string): Promise<ArmHandles> {
  await p.connectAsync();
  const { characteristics } = await p.discoverAllServicesAndCharacteristicsAsync();
  const write = characteristics.find((c) => fullUuid(c.uuid) === WRITE_CHAR)!;
  const notify = characteristics.find((c) => fullUuid(c.uuid) === NOTIFY_CHAR)!;
  const waiters = new Map<string, (f: Uint8Array) => void>();
  const arm: ArmHandles = { peripheral: p, write, notify, waiters };
  notify.on("data", (data: Buffer) => {
    const frame = new Uint8Array(data);
    const parsed = parseRxFrame(frame);
    if (parsed.ok && parsed.msgSeq !== undefined && parsed.msgSeq >= 0) {
      const key = `${parsed.sid}:${parsed.msgSeq}`;
      const w = waiters.get(key);
      if (w) { waiters.delete(key); w(frame); }
    }
    console.log(`[${ts()}] ${label} RX sid=${parsed.sid?.toString(16)} type=${parsed.msgType} seq=${parsed.msgSeq} hex=${data.toString("hex")}`);
  });
  await notify.subscribeAsync();
  // @ts-ignore
  const inner = (p as any)._noble;
  if (inner && typeof inner.setMaxListeners === "function") inner.setMaxListeners(2000);
  return arm;
}

function waitForAck(arm: ArmHandles, sid: number, seq: number, timeoutMs: number) {
  return new Promise<Uint8Array | null>((resolve) => {
    const key = `${sid}:${seq}`;
    const t = setTimeout(() => { arm.waiters.delete(key); resolve(null); }, timeoutMs);
    arm.waiters.set(key, (f) => { clearTimeout(t); resolve(f); });
  });
}

async function sendFrames(arm: ArmHandles, frames: Uint8Array[]) {
  for (const f of frames) await arm.write.writeAsync(Buffer.from(f), true);
}

async function main() {
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) { argMap[a.slice(2)] = next; i++; }
      else argMap[a.slice(2)] = "true";
    }
  }

  let items: string[];
  if (argMap["file"]) {
    const t = await Bun.file(argMap["file"]!).text();
    items = t.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } else if (argMap["items"]) {
    items = argMap["items"]!.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    items = ["❯ ⌘  Home", "◆  Tasks", "▶  Logs", "✦  Settings"];
  }

  const name = argMap["name"] || "cmux-list";
  const width = parseInt(argMap["width"] || "280", 10);
  const height = parseInt(argMap["height"] || "130", 10);
  const x = parseInt(argMap["x"] || "10", 10);
  const y = parseInt(argMap["y"] || "10", 10);
  const skipPrelude = argMap["no-prelude"] === "true";

  console.log(`[${ts()}] g2-list-send: ${items.length} items → ${name}`);
  for (const it of items) console.log(`  • ${it}`);

  if (noble.state !== "poweredOn") await noble.waitForPoweredOnAsync(6000);
  console.log(`[${ts()}] scanning...`);
  const { L, R } = await findBothArms();
  const armA = await connectArm(R, "A/R");
  const armB = await connectArm(L, "B/L");
  console.log(`[${ts()}] connected, settling 800ms`);
  await new Promise((r) => setTimeout(r, 800));

  if (!skipPrelude) {
    console.log(`[${ts()}] prelude: f5872 (sid=01 app-launch)`);
    const a1 = waitForAck(armA, 0x01, 156, 5000);
    await armA.write.writeAsync(Buffer.from(PRELUDE_F5872), true);
    if (!(await a1)) { console.error("prelude ack timeout"); process.exit(1); }
  }

  const cfg = buildStartUpPageConfig({ x, y, width, height, name, items });
  const msg = buildCreateMsg(cfg);
  const magic = 201;
  const outer = buildOuter(magic, msg);
  console.log(`[${ts()}] outer pb=${outer.length}B`);
  const frames = buildBleFrames(outer, 0x40, 0xe0, 0x20);
  console.log(`[${ts()}] fragmenting into ${frames.length} BLE frames`);

  // Cmd=0 ack = Cmd=1. Watch sid=e0 matching magic.
  const ackP = waitForAck(armA, 0xe0, magic, 5000);
  const t0 = performance.now();
  await sendFrames(armA, frames);
  const ack = await ackP;
  const ms = performance.now() - t0;
  if (!ack) {
    console.warn(`[${ts()}] NO ACK after ${ms.toFixed(0)}ms`);
  } else {
    console.log(`[${ts()}] ack ${ms.toFixed(0)}ms hex=${Buffer.from(ack).toString("hex")}`);
  }

  console.log(`[${ts()}] holding 5s then disconnect`);
  await new Promise((r) => setTimeout(r, 5000));
  await armA.peripheral.disconnectAsync().catch(() => {});
  await armB.peripheral.disconnectAsync().catch(() => {});
  process.exit(0);
}

main().catch((e) => { console.error("error:", e?.message || e); process.exit(1); });
