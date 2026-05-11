// R1 Ring scanner - discovers Even Realities ring and other health wearables
import noble from "@stoprocent/noble";

const seen = new Map<string, {
  name: string;
  rssi: number;
  services: string[];
  mfgData: string;
  raw: Buffer | null;
}>();

console.log("Scanning for R1 ring / health wearables... (30s timeout)\n");

// Known patterns:
// - Even G2 glasses: "Even G#_<serial>_<L|R>_"
// - R1 ring: unknown pattern, likely "Even R1_" or similar, or just "R1"
// - Typical health rings: Oura, Colmi, RingConn, etc.

const RING_PATTERNS = [
  /ring/i,
  /r1/i,
  /even/i,
  /oura/i,
  /colmi/i,
  /health/i,
  /hr/i,
  /heart/i,
];

// Common health device service UUIDs
const HEALTH_SERVICES = new Set([
  "180d", // Heart Rate
  "1810", // Blood Pressure
  "181c", // User Data
  "181d", // Weight Scale
  "1822", // Pulse Oximeter
  "fe9f", // Google Fast Pair
]);

noble.on("discover", (p) => {
  const name = p.advertisement.localName || "";
  const uuid = p.uuid;
  const rssi = p.rssi;
  const services = (p.advertisement.serviceUuids || []).map(u => u.toLowerCase());
  const mfgData = p.advertisement.manufacturerData?.toString("hex") || "";

  // Check if this looks like a ring or health device
  const nameMatch = RING_PATTERNS.some(re => re.test(name));
  const serviceMatch = services.some(s => HEALTH_SERVICES.has(s.slice(0, 4)));
  const isEvenDevice = mfgData.startsWith("455253"); // "ERS" prefix seen in G2 mfg data

  const isInteresting = nameMatch || serviceMatch || isEvenDevice || name.length > 0;

  if (!seen.has(uuid) && isInteresting) {
    seen.set(uuid, {
      name: name || "(no name)",
      rssi,
      services,
      mfgData,
      raw: p.advertisement.manufacturerData,
    });

    const tags: string[] = [];
    if (nameMatch) tags.push("NAME-MATCH");
    if (serviceMatch) tags.push("HEALTH-SVC");
    if (isEvenDevice) tags.push("EVEN-MFG");

    console.log(`[NEW] ${name || "(no name)"} ${tags.length ? `[${tags.join(", ")}]` : ""}`);
    console.log(`      UUID: ${uuid}`);
    console.log(`      RSSI: ${rssi} dBm`);
    if (services.length > 0) {
      console.log(`      Services: ${services.join(", ")}`);
    }
    if (mfgData) {
      console.log(`      MfgData: ${mfgData}`);
      // Try to decode as ASCII if printable
      if (p.advertisement.manufacturerData) {
        const ascii = p.advertisement.manufacturerData.toString("ascii").replace(/[^\x20-\x7e]/g, ".");
        console.log(`      MfgASCII: ${ascii}`);
      }
    }
    console.log();
  }
});

noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    await noble.startScanningAsync([], true);
  }
});

function summary() {
  console.log("\n--- Summary ---");
  console.log(`Found ${seen.size} interesting devices:\n`);
  for (const [uuid, info] of seen) {
    console.log(`  ${info.name.padEnd(30)} RSSI=${info.rssi} ${info.services.length ? `svc=[${info.services.join(",")}]` : ""}`);
  }
  process.exit(0);
}

setTimeout(summary, 30_000);
process.on("SIGINT", summary);
