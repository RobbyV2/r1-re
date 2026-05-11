#!/usr/bin/env bun
// parse-snoop.ts — parse a tab-separated hex log into a structured view.
//
// Input format: one frame per line, tab-separated columns, last column is
// hex bytes (optionally colon-separated). You can produce this format via
// tshark:
//
//   tshark -r cap.btsnoop \
//          -Y "btatt.opcode == 0x12 || btatt.opcode == 0x52" \
//          -T fields -e frame.number -e frame.time_relative -e btatt.value \
//          > writes.txt
//
// Usage:
//   bun parse-snoop.ts writes.txt
//   bun parse-snoop.ts writes.txt --magic aa21 --sid 0x06
//
// This tool assumes an EvenHub-style envelope by default:
//   [0] magic0  [1] magic1  [2] seq  [3] len  [4] totFrag  [5] fragIdx
//   [6] sid     [7] flag    [8..]    payload  (+optional CRC trailer)
//
// You almost certainly want to adapt the byte offsets for your target.

import { readFileSync } from "fs";

const args = process.argv.slice(2);
let logPath = "";
let magic: Uint8Array | null = new Uint8Array([0xaa, 0x21]); // EvenHub default; override with --magic
let sidFilter: number | null = null;
let fragFilter: "single" | "multi" | null = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--magic") {
    const hex = args[++i]!;
    magic = hex === "none" ? null : new Uint8Array(Buffer.from(hex, "hex"));
  } else if (a === "--sid") {
    sidFilter = parseInt(args[++i]!, 16);
  } else if (a === "--single-frag") {
    fragFilter = "single";
  } else if (a === "--multi-frag") {
    fragFilter = "multi";
  } else if (!logPath) {
    logPath = a;
  } else {
    throw new Error(`unknown arg: ${a}`);
  }
}

if (!logPath) {
  console.error("usage: bun parse-snoop.ts <log.txt> [--magic HEX|none] [--sid 0xNN] [--single-frag|--multi-frag]");
  process.exit(1);
}

type Pkt = {
  frame: number;
  t: number;
  seq: number;
  len: number;
  totalFrags: number;
  fragIdx: number;
  sid: number;
  flag: number;
  body: Uint8Array;
  trailer: string;
};

const lines = readFileSync(logPath, "utf8").trim().split("\n");
const pkts: Pkt[] = [];

for (const line of lines) {
  const cols = line.split("\t");
  if (cols.length < 1) continue;
  const hexRaw = cols[cols.length - 1]!;
  const hex = hexRaw.replace(/[:\s]/g, "");
  if (hex.length < 16 || hex.length % 2) continue;
  const b = Buffer.from(hex, "hex");

  if (magic) {
    let ok = true;
    for (let k = 0; k < magic.length; k++) if (b[k] !== magic[k]) { ok = false; break; }
    if (!ok) continue;
  }

  const seq = b[2] ?? 0;
  const len = b[3] ?? 0;
  const totalFrags = b[4] ?? 0;
  const fragIdx = b[5] ?? 0;
  const sid = b[6] ?? 0;
  const flag = b[7] ?? 0;
  const body = new Uint8Array(b.subarray(8, 8 + Math.max(0, len - 2)));
  const trailer = Buffer.from(b.subarray(8 + Math.max(0, len - 2))).toString("hex");

  const frame = cols.length >= 3 ? parseFloat(cols[0]!) || 0 : 0;
  const t = cols.length >= 3 ? parseFloat(cols[1]!) || 0 : 0;

  if (sidFilter !== null && sid !== sidFilter) continue;
  if (fragFilter === "single" && !(totalFrags === 1 && fragIdx === 1)) continue;
  if (fragFilter === "multi" && totalFrags === 1) continue;

  pkts.push({ frame, t, seq, len, totalFrags, fragIdx, sid, flag, body, trailer });
}

console.log(`=== ${pkts.length} packets${sidFilter !== null ? ` sid=0x${sidFilter.toString(16)}` : ""} ===`);

for (const p of pkts) {
  const asc = Buffer.from(p.body).toString("latin1").replace(/[^\x20-\x7e]/g, ".");
  console.log(
    `f=${String(p.frame).padStart(5)} t=${p.t.toFixed(2).padStart(7)} seq=${String(p.seq).padStart(3)} frag=${p.fragIdx}/${p.totalFrags} len=${String(p.len).padStart(3)} sid=0x${p.sid.toString(16).padStart(2,"0")} flag=0x${p.flag.toString(16).padStart(2,"0")}`
  );
  console.log(`       hex=${Buffer.from(p.body).toString("hex")}${p.trailer ? ` trailer=${p.trailer}` : ""}`);
  console.log(`       asc=${asc}`);
}
