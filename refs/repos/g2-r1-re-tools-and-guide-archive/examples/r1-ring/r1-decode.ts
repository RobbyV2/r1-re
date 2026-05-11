// R1 Ring packet decoder based on decompiled BleRing1 enum analysis
//
// Packet structure (discovered):
// [0]    = 0x00 (frame type)
// [1]    = length of remaining bytes
// [2]    = 0x61 (marker/subsystem)
// [3]    = method (0=get, 1=set)
// [4]    = cmd code
// [5..n-2] = payload
// [n-1,n] = trailer (0x8a 0x03 observed)

const CMD_NAMES: Record<number, string> = {
  0x00: "system",
  0x01: "heartRate",
  0x02: "spo2",
  0x03: "temperature",
  0x04: "hrv",
  0x05: "activity",
  0x06: "sleep",
  0x07: "sportRunCtrl",
  0x08: "sportRunData",
  0x09: "healthSetting",
};

const METHOD_NAMES: Record<number, string> = {
  0x00: "get",
  0x01: "set",
};

export function decodeR1Packet(data: Buffer | Uint8Array): string | null {
  if (data.length < 7) return null;

  const frameType = data[0];
  const length = data[1];
  const marker = data[2];
  const method = data[3];
  const cmd = data[4];

  if (frameType !== 0x00 || marker !== 0x61) {
    return `unknown frame: type=0x${frameType.toString(16)} marker=0x${marker.toString(16)}`;
  }

  const cmdName = CMD_NAMES[cmd] || `cmd_0x${cmd.toString(16)}`;
  const methodName = METHOD_NAMES[method] || `method_0x${method.toString(16)}`;

  // Payload is bytes 5 to length-2 (excluding 2-byte trailer)
  const payloadEnd = Math.min(data.length - 2, 1 + length);
  const payload = data.slice(5, payloadEnd);

  let decoded = `${cmdName} (${methodName})`;

  // Decode payload based on command type
  if (payload.length >= 2) {
    const v1 = payload.readUInt16LE(0);
    decoded += ` val1=${v1}`;
  }
  if (payload.length >= 4) {
    const v2 = payload.readUInt16LE(2);
    decoded += ` val2=${v2}`;
  }
  if (payload.length >= 6) {
    const v3 = payload.readUInt16LE(4);
    decoded += ` val3=${v3}`;
  }

  // Interpret based on cmd
  switch (cmd) {
    case 0x01: // heartRate
      if (payload.length >= 2) {
        const hr = payload.readUInt16LE(0);
        decoded = `heartRate: ${hr} bpm`;
      }
      break;
    case 0x02: // spo2
      if (payload.length >= 2) {
        const spo2 = payload.readUInt16LE(0);
        decoded = `spo2: ${spo2}%`;
      }
      break;
    case 0x03: // temperature
      if (payload.length >= 2) {
        // Temp might be in 0.01 degree units
        const tempRaw = payload.readUInt16LE(0);
        const tempC = tempRaw / 100;
        decoded = `temperature: ${tempC.toFixed(2)}°C`;
      }
      break;
    case 0x05: // activity
      if (payload.length >= 4) {
        const steps = payload.readUInt16LE(0);
        const timestamp = payload.readUInt16LE(2);
        decoded = `activity: steps=${steps} ts=${timestamp}`;
      }
      break;
  }

  return decoded;
}

// Test with captured packets
if (import.meta.main) {
  const testPackets = [
    "000961000532103ef58a03",
    "00096100051723a5f58a03",
    "00096100051c0d10f68a03",
    "00096100050f07a0f68a03",
    "00096100050f0c09f78a03",
    "00096100041011acf88a03",
    "00096100051385e5f98a03",
    "0009610005419624fb8a03",
  ];

  console.log("Decoding captured R1 packets:\n");
  for (const hex of testPackets) {
    const buf = Buffer.from(hex, "hex");
    const decoded = decodeR1Packet(buf);
    console.log(`${hex}`);
    console.log(`  → ${decoded}\n`);
  }
}
