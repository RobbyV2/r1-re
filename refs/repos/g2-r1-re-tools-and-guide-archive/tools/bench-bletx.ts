#!/usr/bin/env bun
// bench-bletx.ts — measure raw BLE writeWithoutResponse throughput.
//
// Goal: find out whether you're at the CoreBluetooth connection-interval
// ceiling (~1 packet per BLE connection interval) or whether your
// higher-level code is wasting headroom with serial awaits. Runs SERIAL
// (await each write) then QUEUED (dispatch all, await at the end).
//
// If SERIAL is 5× slower than QUEUED, you have pacing headroom.
// If SERIAL ≈ QUEUED, you're link-bound and protocol-level optimization
// is the only lever left.
//
// Usage:
//   bun bench-bletx.ts --name-re 'even R1' --write-uuid 'bae80012-...' [--size 240] [--count 200]
//
// Substitute the name regex and write-characteristic UUID for your target.

import noble from "@stoprocent/noble";
import type { Peripheral, Characteristic } from "@stoprocent/noble";

const args = process.argv.slice(2);
let NAME_RE = /./; // default: match anything, user should override
let WRITE = "";
let SIZE = 240;
let N = 200;
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--name-re") NAME_RE = new RegExp(args[++i]!, "i");
  else if (a === "--write-uuid") WRITE = args[++i]!.toLowerCase();
  else if (a === "--size") SIZE = parseInt(args[++i]!, 10);
  else if (a === "--count") N = parseInt(args[++i]!, 10);
}
if (!WRITE) {
  console.error("usage: bun bench-bletx.ts --name-re <regex> --write-uuid <uuid> [--size N] [--count N]");
  process.exit(1);
}
const fullUuid = (u: string) => {
  const s = u.toLowerCase().replace(/-/g, "");
  return s.length === 32
    ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
    : s;
};

async function main() {
  if (noble.state !== "poweredOn") await noble.waitForPoweredOnAsync(6000);
  console.log(`bench: size=${SIZE}B N=${N} name-re=${NAME_RE}`);

  let target: Peripheral | null = null;
  await new Promise<void>(async (resolve) => {
    const onDiscover = (p: Peripheral) => {
      if (!NAME_RE.test(p.advertisement.localName || "")) return;
      if (!target) {
        target = p;
        noble.off("discover", onDiscover);
        noble.stopScanningAsync().then(() => resolve());
      }
    };
    noble.on("discover", onDiscover);
    await noble.startScanningAsync([], true);
    setTimeout(() => {
      noble.off("discover", onDiscover);
      noble.stopScanningAsync().then(() => resolve());
    }, 10000);
  });
  if (!target) {
    console.error(`no matching device found`);
    process.exit(1);
  }

  console.log(`connecting to ${target.advertisement.localName || target.uuid}...`);
  await target.connectAsync();
  console.log(`connected, mtu=${target.mtu}`);

  // Noble installs a `disconnect:<id>` once-listener per write via
  // _withDisconnectHandler. 200 writes in serial blow past EventEmitter's
  // default maxListeners=10. Bump it on the peripheral's internal emitter.
  // @ts-ignore - _noble is private.
  const inner = (target as any)._noble;
  if (inner && typeof inner.setMaxListeners === "function") {
    inner.setMaxListeners(N * 4 + 100);
  }

  const { characteristics } = await target.discoverAllServicesAndCharacteristicsAsync();
  const write = characteristics.find((c) => fullUuid(c.uuid) === WRITE) as Characteristic;
  if (!write) {
    console.error("no write char");
    process.exit(1);
  }

  const frame = Buffer.alloc(SIZE, 0xff);
  frame[0] = 0xaa;
  frame[1] = 0x21;
  frame[2] = 0xff; // seq — doesn't matter; we're measuring transport, not decoding

  // Warmup
  for (let i = 0; i < 10; i++) await write.writeAsync(frame, true);

  // SERIAL: one-at-a-time. Per-write latency includes BLE pacing.
  console.log(`SERIAL run: ${N} writes of ${SIZE}B, awaited one at a time...`);
  const serialTs: number[] = [];
  const t0 = performance.now();
  let prev = t0;
  for (let i = 0; i < N; i++) {
    await write.writeAsync(frame, true);
    const now = performance.now();
    serialTs.push(now - prev);
    prev = now;
  }
  const t1 = performance.now();
  const serialDt = t1 - t0;
  serialTs.sort((a, b) => a - b);
  const p50 = serialTs[Math.floor(serialTs.length * 0.5)]!;
  const p90 = serialTs[Math.floor(serialTs.length * 0.9)]!;
  const p99 = serialTs[Math.floor(serialTs.length * 0.99)]!;
  console.log(
    `SERIAL: ${N} × ${SIZE}B in ${serialDt.toFixed(0)}ms → ` +
      `${((N * 1000) / serialDt).toFixed(1)} frames/s = ` +
      `${((N * SIZE) / serialDt).toFixed(2)} KB/s`,
  );
  console.log(
    `  per-frame: mean=${(serialDt / N).toFixed(2)}ms p50=${p50.toFixed(2)} p90=${p90.toFixed(2)} p99=${p99.toFixed(2)}`,
  );

  // QUEUED: fire N without awaiting, then await all. Tests if noble's
  // writeAsync returns immediately (queue-only) or blocks on link-layer credit.
  console.log(`QUEUED run: ${N} writes dispatched without intermediate await...`);
  const t2 = performance.now();
  const promises: Promise<void>[] = [];
  for (let i = 0; i < N; i++) promises.push(write.writeAsync(frame, true));
  await Promise.all(promises);
  const t3 = performance.now();
  const queuedDt = t3 - t2;
  console.log(
    `QUEUED: ${N} × ${SIZE}B in ${queuedDt.toFixed(0)}ms → ` +
      `${((N * 1000) / queuedDt).toFixed(1)} frames/s = ` +
      `${((N * SIZE) / queuedDt).toFixed(2)} KB/s`,
  );

  await target.disconnectAsync();
  console.log("done");
  process.exit(0);
}

main().catch((e) => {
  console.error("bench failed:", e?.message || e);
  process.exit(1);
});
