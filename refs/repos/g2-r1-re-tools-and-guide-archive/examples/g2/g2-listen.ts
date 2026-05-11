#!/usr/bin/env bun
// Passive BLE listener. Connect to both arms, subscribe notify, dump every
// inbound frame categorized by sid. Use to discover spontaneous events
// (touch, head motion, battery notifications, etc.).

import noble from "@stoprocent/noble";
import type { Peripheral, Characteristic } from "@stoprocent/noble";

const NAME_RE = /(?:even\s+)?G\d+_(\d+)_([LR])_/i;
const WRITE_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5401";
const NOTIFY_CHAR = "00002760-08c2-11e1-9073-0e8ac72e5402";
const fullUuid = (u: string) => {
  const s = u.toLowerCase().replace(/-/g, "");
  return s.length === 32 ? `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}` : s;
};

const ts = () => {
  const t = new Date();
  return `${t.toISOString().slice(11, 19)}.${String(t.getMilliseconds()).padStart(3, "0")}`;
};

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

async function main() {
  const durationSec = parseInt(process.argv[2] || "30", 10);
  const skipPrelude = process.argv.includes("--no-prelude");
  console.log(`[${ts()}] g2-listen: ${durationSec}s`);
  if (noble.state !== "poweredOn") await noble.waitForPoweredOnAsync(6000);
  console.log(`[${ts()}] scanning...`);
  const { L, R } = await findBothArms();

  const subs: { label: string; p: Peripheral; notify: Characteristic; write?: Characteristic }[] = [];
  for (const [label, p] of [["R", R], ["L", L]] as const) {
    await p.connectAsync();
    const { characteristics } = await p.discoverAllServicesAndCharacteristicsAsync();
    const notify = characteristics.find((c) => fullUuid(c.uuid) === NOTIFY_CHAR)!;
    const write = characteristics.find((c) => fullUuid(c.uuid) === WRITE_CHAR);
    notify.on("data", (data: Buffer) => {
      const hex = data.toString("hex");
      const sid = data.length >= 7 ? data[6]!.toString(16).padStart(2, "0") : "??";
      const flag = data.length >= 8 ? data[7]!.toString(16).padStart(2, "0") : "??";
      console.log(`[${ts()}] ${label} sid=${sid} flag=${flag} ${data.length}B ${hex}`);
    });
    await notify.subscribeAsync();
    // @ts-ignore
    const inner = (p as any)._noble;
    if (inner?.setMaxListeners) inner.setMaxListeners(2000);
    subs.push({ label, p, notify, write });
    console.log(`[${ts()}] ${label} connected+subscribed`);
  }

  // Optional prelude on R so that app-launch state is set; helps see what the
  // glasses spontaneously emit once they think the app is live.
  if (!skipPrelude) {
    const PRELUDE_F5872 = Buffer.from("aa2192130101012008021 09c01220a1a0812061204080010 00a142".replace(/\s+/g, ""), "hex");
    const rwrite = subs[0]!.write;
    if (rwrite) {
      console.log(`[${ts()}] sending f5872 (sid=01 app-launch) to R...`);
      await rwrite.writeAsync(PRELUDE_F5872, true);
    }
  }

  console.log(`[${ts()}] listening for ${durationSec}s. Move / tap / look around / etc.`);
  await new Promise((r) => setTimeout(r, durationSec * 1000));
  for (const s of subs) await s.p.disconnectAsync().catch(() => {});
  console.log(`[${ts()}] done`);
  process.exit(0);
}

main().catch((e) => { console.error("error:", e?.message || e); process.exit(1); });
