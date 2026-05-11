#!/usr/bin/env bun
// crc-hunt.ts — brute-force a packet protocol's checksum.
//
// Reads a tab-separated hex log (one packet per line, tab-separated,
// last column is hex bytes optionally colon-separated). Filters to
// matching packets. For every common CRC-16 variant × scope ×
// endianness, tests if the computed value matches the trailing 2
// bytes across *all* samples.
//
// Usage:
//   bun crc-hunt.ts path/to/log.txt
//   bun crc-hunt.ts log.txt --magic aa21 --non-frag --min 4 --extras
//
// Flags:
//   --magic HEX       require frames to start with these hex bytes
//                     (default: none — accept everything)
//   --non-frag        require totalFrags=1, fragIdx=1 at bytes [4..5]
//                     (useful for EvenHub-style envelopes)
//   --filter 'byte[N]=0xXX'  arbitrary byte filter (repeatable)
//   --min N           minimum sample count (default 4)
//   --max N           maximum samples to collect (default 10)
//   --extras          also try Fletcher-16 and sum checksums
//   --hex-col COL     0-indexed column containing the hex (default: last)
//
// Output: every (variant, scope, endianness) combination that matches
// every sample. If nothing matches, you almost certainly need
// --extras, or your CRC isn't over the wire bytes (try reassembled
// payload for fragmented protocols).

import { readFileSync } from "fs";

type Variant = readonly [name: string, poly: number, init: number, refIn: boolean, refOut: boolean, xorOut: number];

const VARIANTS: Variant[] = [
  ["ARC",            0x8005, 0x0000, true,  true,  0x0000],
  ["AUG-CCITT",      0x1021, 0x1d0f, false, false, 0x0000],
  ["BUYPASS",        0x8005, 0x0000, false, false, 0x0000],
  ["CCITT-FALSE",    0x1021, 0xffff, false, false, 0x0000],
  ["CDMA2000",       0xc867, 0xffff, false, false, 0x0000],
  ["DDS-110",        0x8005, 0x800d, false, false, 0x0000],
  ["DECT-R",         0x0589, 0x0000, false, false, 0x0001],
  ["DECT-X",         0x0589, 0x0000, false, false, 0x0000],
  ["DNP",            0x3d65, 0x0000, true,  true,  0xffff],
  ["EN-13757",       0x3d65, 0x0000, false, false, 0xffff],
  ["GENIBUS",        0x1021, 0xffff, false, false, 0xffff],
  ["KERMIT",         0x1021, 0x0000, true,  true,  0x0000],
  ["LJ1200",         0x6f63, 0x0000, false, false, 0x0000],
  ["MAXIM",          0x8005, 0x0000, true,  true,  0xffff],
  ["MCRF4XX",        0x1021, 0xffff, true,  true,  0x0000],
  ["MODBUS",         0x8005, 0xffff, true,  true,  0x0000],
  ["RIELLO",         0x1021, 0xb2aa, true,  true,  0x0000],
  ["T10-DIF",        0x8bb7, 0x0000, false, false, 0x0000],
  ["TELEDISK",       0xa097, 0x0000, false, false, 0x0000],
  ["TMS37157",       0x1021, 0x89ec, true,  true,  0x0000],
  ["USB",            0x8005, 0xffff, true,  true,  0xffff],
  ["CRC-A",          0x1021, 0xc6c6, true,  true,  0x0000],
  ["X-25",           0x1021, 0xffff, true,  true,  0xffff],
  ["XMODEM",         0x1021, 0x0000, false, false, 0x0000],
];

const SCOPES = [
  { name: "[0..end-2]",  start: 0,  trim: 2 },
  { name: "[1..end-2]",  start: 1,  trim: 2 },
  { name: "[2..end-2]",  start: 2,  trim: 2 },
  { name: "[3..end-2]",  start: 3,  trim: 2 },
  { name: "[4..end-2]",  start: 4,  trim: 2 },
  { name: "[6..end-2]",  start: 6,  trim: 2 },
  { name: "[8..end-2]",  start: 8,  trim: 2 },
  { name: "[0..end]",    start: 0,  trim: 0 },
  { name: "[2..end]",    start: 2,  trim: 0 },
  { name: "[4..end]",    start: 4,  trim: 0 },
];

function reflect8(b: number): number {
  let r = 0;
  for (let i = 0; i < 8; i++) if (b & (1 << i)) r |= 1 << (7 - i);
  return r;
}
function reflect16(w: number): number {
  let r = 0;
  for (let i = 0; i < 16; i++) if (w & (1 << i)) r |= 1 << (15 - i);
  return r;
}
function crc16(bytes: Uint8Array, poly: number, init: number, refIn: boolean, refOut: boolean, xorOut: number): number {
  let crc = init;
  for (let b of bytes) {
    if (refIn) b = reflect8(b);
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ poly) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  if (refOut) crc = reflect16(crc);
  return crc ^ xorOut;
}

// --- "extras" — non-CRC checksums, for when nothing else fits ---
function xorAll(b: Uint8Array) { let x = 0; for (const v of b) x ^= v; return x; }
function sum16(b: Uint8Array) { let s = 0; for (const v of b) s = (s + v) & 0xffff; return s; }
function fletcher16(b: Uint8Array) {
  let s1 = 0, s2 = 0;
  for (const v of b) { s1 = (s1 + v) % 255; s2 = (s2 + s1) % 255; }
  return (s2 << 8) | s1;
}

// --- argv parsing ---
const args = process.argv.slice(2);
let logPath = "";
let requireMagic: Uint8Array | null = null;
let nonFrag = false;
let minSamples = 4;
let maxSamples = 10;
let extras = false;
let hexCol = -1;
const byteFilters: Array<{ off: number; val: number }> = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--magic") {
    requireMagic = new Uint8Array(Buffer.from(args[++i]!, "hex"));
  } else if (a === "--non-frag") {
    nonFrag = true;
  } else if (a === "--filter") {
    const m = /^byte\[(\d+)\]=(0x[0-9a-f]+|\d+)$/i.exec(args[++i]!);
    if (!m) throw new Error("bad --filter syntax; expected byte[N]=0xXX");
    byteFilters.push({ off: parseInt(m[1]!, 10), val: parseInt(m[2]!, m[2]!.startsWith("0x") ? 16 : 10) });
  } else if (a === "--min") {
    minSamples = parseInt(args[++i]!, 10);
  } else if (a === "--max") {
    maxSamples = parseInt(args[++i]!, 10);
  } else if (a === "--extras") {
    extras = true;
  } else if (a === "--hex-col") {
    hexCol = parseInt(args[++i]!, 10);
  } else if (!logPath) {
    logPath = a;
  } else {
    throw new Error(`unknown arg: ${a}`);
  }
}

if (!logPath) {
  console.error("usage: bun crc-hunt.ts <log.txt> [--magic HEX] [--non-frag] [--filter 'byte[N]=0xXX'] [--min N] [--max N] [--extras] [--hex-col N]");
  process.exit(1);
}

const lines = readFileSync(logPath, "utf8").trim().split("\n");
const samples: Uint8Array[] = [];

for (const line of lines) {
  const cols = line.split("\t");
  const hexRaw = cols[hexCol === -1 ? cols.length - 1 : hexCol];
  if (!hexRaw) continue;
  const hex = hexRaw.replace(/[:\s]/g, "");
  if (hex.length < 8 || hex.length % 2) continue;
  const b = new Uint8Array(Buffer.from(hex, "hex"));

  if (requireMagic) {
    if (b.length < requireMagic.length) continue;
    let ok = true;
    for (let k = 0; k < requireMagic.length; k++) if (b[k] !== requireMagic[k]) { ok = false; break; }
    if (!ok) continue;
  }
  if (nonFrag) {
    if (b.length < 6) continue;
    if (b[4] !== 1 || b[5] !== 1) continue;
  }
  let passes = true;
  for (const f of byteFilters) {
    if (b.length <= f.off || b[f.off] !== f.val) { passes = false; break; }
  }
  if (!passes) continue;

  samples.push(b);
  if (samples.length >= maxSamples) break;
}

if (samples.length < minSamples) {
  console.error(`only found ${samples.length} samples; need at least ${minSamples}. Loosen filters.`);
  process.exit(2);
}

console.log(`hunting over ${samples.length} samples from ${logPath}\n`);
for (const s of samples) {
  const tail = Buffer.from(s.subarray(s.length - 2)).toString("hex");
  console.log(`  len=${String(s.length).padStart(3)}  tail=${tail}  head=${Buffer.from(s.subarray(0, Math.min(10, s.length))).toString("hex")}`);
}
console.log();

let matchCount = 0;
for (const v of VARIANTS) {
  const [name, poly, init, refIn, refOut, xorOut] = v;
  for (const s of SCOPES) {
    for (const endian of ["LE", "BE"] as const) {
      let all = true;
      for (const pkt of samples) {
        if (pkt.length <= s.start + 2) { all = false; break; }
        const data = pkt.subarray(s.start, pkt.length - s.trim);
        const crc = crc16(data, poly, init, refIn, refOut, xorOut);
        const tailBE = (pkt[pkt.length - 2]! << 8) | pkt[pkt.length - 1]!;
        const tailLE = (pkt[pkt.length - 1]! << 8) | pkt[pkt.length - 2]!;
        const target = endian === "LE" ? tailLE : tailBE;
        if (crc !== target) { all = false; break; }
      }
      if (all) {
        console.log(`MATCH  ${name.padEnd(14)}  scope=${s.name.padEnd(12)} endian=${endian}`);
        matchCount++;
      }
    }
  }
}

if (extras) {
  console.log("\nextra checksums (scope [0..end-2]):");
  for (const pkt of samples) {
    const d = pkt.subarray(0, pkt.length - 2);
    const tailLE = (pkt[pkt.length - 1]! << 8) | pkt[pkt.length - 2]!;
    const tailBE = (pkt[pkt.length - 2]! << 8) | pkt[pkt.length - 1]!;
    console.log(
      `  tail LE=0x${tailLE.toString(16).padStart(4, "0")} BE=0x${tailBE.toString(16).padStart(4, "0")}  xor=0x${xorAll(d).toString(16)}  sum16=0x${sum16(d).toString(16).padStart(4, "0")}  fletcher16=0x${fletcher16(d).toString(16).padStart(4, "0")}`
    );
  }
}

if (matchCount === 0) {
  console.log("\nno matches. things to try:");
  console.log("  1. --extras            (Fletcher, XOR, sums)");
  console.log("  2. relax filters       (maybe different subsystems use different CRC scopes)");
  console.log("  3. reassembled CRC     (if this is a fragmented protocol, the CRC might be");
  console.log("                          computed over the concatenated payload of all fragments");
  console.log("                          and appear only on the last fragment)");
  console.log("  4. encrypted payload   (if the whole payload looks random, CRC is over ciphertext");
  console.log("                          that you can't reproduce from plaintext alone)");
  process.exit(3);
}
