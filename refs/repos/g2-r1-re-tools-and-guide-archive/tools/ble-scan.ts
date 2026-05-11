// Generic BLE scanner - discovers all nearby devices and logs their info
import noble from "@stoprocent/noble";

const seen = new Map<string, { name: string; rssi: number; services: string[] }>();

console.log("Scanning for BLE devices... (Ctrl+C to stop)\n");

noble.on("discover", (p) => {
  const name = p.advertisement.localName || "(no name)";
  const uuid = p.uuid;
  const rssi = p.rssi;
  const services = (p.advertisement.serviceUuids || []).map(u => u.toLowerCase());

  if (!seen.has(uuid)) {
    seen.set(uuid, { name, rssi, services });
    console.log(`[NEW] ${name}`);
    console.log(`      UUID: ${uuid}`);
    console.log(`      RSSI: ${rssi} dBm`);
    if (services.length > 0) {
      console.log(`      Services: ${services.join(", ")}`);
    }
    // Log raw manufacturer data if present
    if (p.advertisement.manufacturerData) {
      console.log(`      MfgData: ${p.advertisement.manufacturerData.toString("hex")}`);
    }
    console.log();
  }
});

noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    await noble.startScanningAsync([], true); // passive scan, all services
  }
});

// Summary on exit
function summary() {
  console.log("\n--- Summary ---");
  console.log(`Found ${seen.size} devices:\n`);
  for (const [uuid, info] of seen) {
    console.log(`  ${info.name} (${uuid}) RSSI=${info.rssi}`);
  }
  process.exit(0);
}

process.on("SIGINT", summary);

// Auto-exit after 15 seconds
setTimeout(summary, 15_000);
