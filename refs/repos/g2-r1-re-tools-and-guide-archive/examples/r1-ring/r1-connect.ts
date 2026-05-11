// Connect to Even R1 ring and dump all characteristics/data
import noble from "@stoprocent/noble";
import type { Peripheral, Characteristic } from "@stoprocent/noble";

// Ring advertises as "EVEN R1_<serial>" or similar
const RING_RE = /even\s*r1/i;
const TARGET_MAC_END = "8b74"; // Last 2 bytes of the MAC

console.log("Scanning for Even R1 ring...\n");
console.log("Looking for: 'EVEN R1_*' pattern or MAC ending in 8B:74\n");

let found: Peripheral | null = null;

noble.on("discover", async (p) => {
  const name = p.advertisement.localName || "";
  const uuid = p.uuid.toLowerCase();
  const mfgData = p.advertisement.manufacturerData?.toString("hex") || "";

  const nameMatch = RING_RE.test(name);
  const macMatch = !!TARGET_MAC_END && (uuid.includes(TARGET_MAC_END) || mfgData.includes(TARGET_MAC_END));

  if (nameMatch || macMatch) {
    console.log(`[FOUND] ${name || "(no name)"}`);
    console.log(`  UUID: ${uuid}`);
    console.log(`  RSSI: ${p.rssi} dBm`);
    if (mfgData) console.log(`  MfgData: ${mfgData}`);

    if (!found) {
      found = p;
      await noble.stopScanningAsync();
      await connectAndDump(p);
    }
  }
});

async function connectAndDump(p: Peripheral) {
  console.log("\nConnecting...");
  await p.connectAsync();
  console.log("Connected!\n");

  console.log("Discovering services and characteristics...\n");
  const { services, characteristics } = await p.discoverAllServicesAndCharacteristicsAsync();

  console.log(`Found ${services.length} services:\n`);

  for (const svc of services) {
    console.log(`SERVICE: ${svc.uuid}`);

    const chars = characteristics.filter(c => c._serviceUuid === svc.uuid);
    for (const ch of chars) {
      const props = ch.properties.join(", ");
      console.log(`  CHAR: ${ch.uuid} [${props}]`);

      // Try to read if readable
      if (ch.properties.includes("read")) {
        try {
          const data = await ch.readAsync();
          console.log(`    VALUE: ${data.toString("hex")} (${data.length} bytes)`);
          // Try ASCII
          const ascii = data.toString("ascii").replace(/[^\x20-\x7e]/g, ".");
          if (ascii.length > 0 && ascii !== ".".repeat(ascii.length)) {
            console.log(`    ASCII: ${ascii}`);
          }
        } catch (e) {
          console.log(`    READ ERROR: ${e}`);
        }
      }

      // Subscribe to notifications if available
      if (ch.properties.includes("notify") || ch.properties.includes("indicate")) {
        try {
          ch.on("data", (data: Buffer) => {
            console.log(`\n[NOTIFY ${ch.uuid}] ${data.toString("hex")}`);
          });
          await ch.subscribeAsync();
          console.log(`    (subscribed to notifications)`);
        } catch (e) {
          console.log(`    SUBSCRIBE ERROR: ${e}`);
        }
      }
    }
    console.log();
  }

  console.log("Listening for notifications for 60 seconds...\n");
  console.log("(Try interacting with the ring - tap, wear, etc.)\n");

  setTimeout(async () => {
    console.log("\n--- Disconnecting ---");
    await p.disconnectAsync();
    process.exit(0);
  }, 60_000);
}

noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    await noble.startScanningAsync([], true);
  }
});

// Timeout for discovery
setTimeout(async () => {
  if (!found) {
    console.log("\n--- Ring not found after 45 seconds ---");
    console.log("Make sure the ring is:");
    console.log("  - Not on the charger");
    console.log("  - Not already connected to another device");
    console.log("  - In range (close to this Mac)");
    console.log("  - Powered on (may need to tap or put on finger)");
    process.exit(1);
  }
}, 45_000);

process.on("SIGINT", async () => {
  if (found) await found.disconnectAsync().catch(() => {});
  process.exit(0);
});
