# BLE protocol playbook

From "I can see a BLE device in the scanner" to "I can synthesize its
protocol and watch my packets arrive."

This is a sequence of stages. Each stage produces evidence that makes
the next stage possible. Skipping stages is how you spend a day chasing
a phantom.

## Stage 0 — inventory

Before you touch the device, make sure you have:

- The device powered on and in a consistent state (app closed, battery
  charged enough that it won't sleep mid-probe).
- A BLE-capable host (macOS with `@stoprocent/noble`, Linux with
  `bluez`, or an Android phone with a bridge).
- The **companion app** (iOS/Android APK) if there is one.
- A way to capture HCI/btsnoop packets:
  - **Android**: Developer Options → Enable Bluetooth HCI snoop log,
    then reproduce the workflow, then pull `btsnoop_hci.log` via adb.
  - **iOS**: the PacketLogger profile from Apple's Additional Tools
    for Xcode.
  - **macOS host**: `/var/log/Bluetooth/` or Apple's PacketLogger.
- An APK decompiler if you've got an Android app: for Flutter apps,
  [Blutter](https://github.com/worawit/blutter); otherwise JADX for
  regular Android, or Ghidra/IDA for the underlying .so files.

## Stage 1 — scan and fingerprint

Use the generic [`tools/ble-scan.ts`](../tools/ble-scan.ts) to enumerate
nearby devices. You want:

- The **advertised name** — almost always has a format hint (e.g.
  `G1_42_L_ABCD` tells you this device is series G1, serial 42, "L"
  side, firmware suffix ABCD).
- The **advertised service UUIDs** — if any, these are your first lead.
- The **manufacturer data** — a few bytes of opaque blob, usually
  containing either the MAC tail or a firmware version.
- The **RSSI pattern** — if the device has two radios (two-sided AR
  glasses, earbuds), you'll see both.

Write this down. Name patterns rot — if the device rev changes, so
does the name format, and your regex breaks.

## Stage 2 — connect and enumerate

Connect once and dump **all services and characteristics**. For each
characteristic, record:

- UUID (full 128-bit, not just the short form)
- Properties: `read | write | writeWithoutResponse | notify | indicate`
- Which service it belongs to

A typical BLE device has ≤3 characteristics that actually matter:

- One **write** endpoint (phone → device)
- One **notify** endpoint (device → phone)
- Sometimes a second write/notify pair for a secondary channel
  (audio, OTA, bulk data)

The rest are housekeeping (firmware version, battery level, GAP). Note
them but don't waste time on them yet.

## Stage 3 — passive listener

**This is the most important step.** See
[`passive-listener-first.md`](passive-listener-first.md) for the full
argument. In short: subscribe to every notify characteristic, do
**nothing**, and log everything that comes in for 60 seconds.

What you're looking for:

- **Heartbeats**: small packets at regular intervals (1s, 10s). These
  are your "hello the link is alive" signal. Every protocol has them.
- **Spontaneous events**: packets that show up when you touch the
  device, press a button, move it, whatever. These are user input.
- **Keepalive asymmetry**: sometimes only one peer sends, or sends
  different types. Record which endpoint each frame came from.

You should already have your envelope half-sketched after 60 seconds
of listening. Look for the first 2 bytes being the same across all
frames — that's your magic / sync prefix.

## Stage 4 — capture a real workflow

Install the companion app. With HCI snoop enabled, drive the app
through the feature you want to reverse:

- "Display text on the lens"
- "Play audio"
- "Start navigation"

One focused workflow at a time. Keep sessions short (under 2 minutes)
so the capture is scannable. Label each capture file by date + what
the app was doing: `2026-04-13-teleprompt-hello-world.btsnoop`.

Convert to a tab-separated hex log so your scripts can read it:

```bash
# via tshark
tshark -r capture.btsnoop -Y "btatt.opcode == 0x12 || btatt.opcode == 0x52" \
       -T fields -e frame.number -e frame.time_relative \
       -e btatt.value > writes.txt
```

Pick an opcode filter that matches `writeRequest` and
`writeWithoutResponse` (0x12 and 0x52 for GATT writes). The columns
you want are frame number, timestamp, and the hex payload.

## Stage 5 — parse the envelope

Run [`tools/parse-snoop.ts`](../tools/parse-snoop.ts) against the hex
log. Look at the first few bytes of each frame. Typically you'll see:

```
aa 21 <seq> <len> <totalFrags> <fragIdx> <sid> <flag> <payload...>
```

- `aa` / `fe` / `a5` / `55` — common magic bytes
- A sequence counter that increments monotonically
- A length byte or length word
- Fragmentation fields (current frag / total frags) — if you see the
  same sequence number repeated with different `fragIdx` values,
  that's app-level fragmentation
- A subsystem / service / command id
- A flag byte (request vs response, direction, etc.)
- Payload
- Optional trailing CRC

Don't assume. Look at packets where you know what happened (e.g. "I
pressed button A") and compare byte-by-byte against packets where you
did something else. Diff is your friend.

## Stage 6 — find the CRC

If the envelope has 2 trailing bytes that aren't length/flag/id and
that change every packet, it's a CRC. Use
[`tools/crc-hunt.ts`](../tools/crc-hunt.ts) to brute-force the poly,
init, reflection, scope, and endianness. See
[`crc-hunting.md`](crc-hunting.md) for the full procedure.

When you find a match, verify it against **every** captured frame
(not just 3). A false match will survive 3 samples but fail on the
4th.

**Fragment trap**: CRCs in fragmented protocols are often computed
over the **reassembled payload**, not per-fragment. If your brute-force
fails on all single-fragment packets, try concatenating all fragments
of a multi-frag message and CRC'ing the result. This is how the G2
protocol hid its CRC for a whole day (see
[case-study-g2.md](case-study-g2.md)).

## Stage 7 — decode the payload

Once the envelope is pinned, the payload is the fun part. Options,
from best to worst:

1. **Protobuf** — if you see `0x08`, `0x10`, `0x1a`, etc. in the
   first few payload bytes, and the values look like small integers
   or bytes blobs, it's almost certainly protobuf. Try
   `protoc --decode_raw` on the raw payload; if it decodes, you've
   won. Then find the `.proto` files in the decompiled app —
   Flutter/Dart AOT keeps them, Blutter can extract them.
2. **Custom binary** — fixed offsets, little/big endian ints, often
   with a 2-byte header marker (`0x00 <length>` is the pattern used
   by the R1 ring, see [case-study-r1-ring.md](case-study-r1-ring.md)).
   Start by diffing two known payloads and see which bytes changed.
3. **JSON / CBOR** — rare on BLE (too expensive) but possible on
   OTA / config endpoints. CBOR starts with distinctive tag bytes.
4. **Encrypted blob** — if everything looks random, you're probably
   looking at a post-auth channel. Find the key-exchange frames
   first. Common patterns: static XOR key, pre-shared key from the
   app binary, BLE Secure Connections pairing.

## Stage 8 — replay

Before synthesizing, **replay** a captured workflow. Just write the
bytes back to the write characteristic in order, respecting timing.
This proves:

- Your envelope parser is correct (you can reconstruct captured
  frames and they still work).
- The device is stateless enough to accept a replay, or your replay
  is driving the state machine correctly.
- You understand the ack / back-pressure pattern (if the device
  doesn't ack, you stop sending).

The working example: [`examples/g2/g2-img-send.ts`](../examples/g2/g2-img-send.ts)
supports both replay (byte-for-byte from capture) and synthesis
(generate the protobuf from scratch). Having both in one tool is
incredibly useful — you can diff synthesized output against the
captured wire bytes and find where your builder disagrees.

## Stage 9 — synthesize

The final boss: build a frame from scratch, no capture involved.
When your synthesized frame produces the same device behavior as the
captured one, you've reverse-engineered the protocol.

Order of operations:

1. Copy the capture's frame exactly. Verify it works.
2. Change one field (e.g. the sequence number). Verify still works.
3. Change the payload to something different but structurally
   identical (same protobuf shape, different string). Verify.
4. Change the payload structure. Verify.
5. Now you own the protocol.

If step 3 fails when step 2 succeeded, you've hit content validation —
the device is checking the payload against some invariant you don't
understand yet. Common culprits:

- Content-aware CRC (CRC over the decoded message, not the wire)
- Length field inside the payload that has to match the outer length
- A magic/version byte buried in a nested struct
- Byte ordering on multi-byte fields inside the payload

Diff the wire bytes of a working and a failing frame until you find
the disagreement.

## What "done" looks like

You know you're done when:

- You can send a frame you never captured and get the expected
  response.
- You can read a device-emitted frame and tell someone what happened
  without re-running the capture.
- You can predict what a new feature in the companion app will look
  like on the wire without running it.
- You can write a new client in whatever language you want in an
  afternoon, because everything is documented.

The G2 case study hit all four of these after about two weeks of
evening work.
