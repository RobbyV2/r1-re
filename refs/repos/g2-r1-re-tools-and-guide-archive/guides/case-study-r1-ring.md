# Case study: Even R1 health ring

A shorter companion case study to the G2 glasses. Different protocol
style: custom binary framing (not protobuf), direct health-sensor
telemetry, and a relay path through a second BLE device.

## The target

Even R1 smart ring. BLE peripheral, advertises as `EVEN R1_<serial>`.
Tracks heart rate, SpO2, HRV, skin temperature, activity (steps,
kcal), sleep. Can be used standalone with its own companion app, or
paired with a G2 glasses to relay data through the glasses.

## What was different from G2

1. **Not Flutter.** The R1 companion app is native Kotlin/Java on
   Android. JADX was enough; Blutter wasn't needed.
2. **Not protobuf.** The wire format is a fixed-offset custom binary
   frame, not protobuf. That's a simpler format but a very different
   decoder.
3. **Relay path.** The most interesting bit: when paired with G2
   glasses, ring data doesn't come over the ring's own BLE channel —
   it's **relayed** through the glasses, arriving on the G2's
   `sid=0x90` (UX_RING_ROW_DATA_ID) and `sid=0x91`
   (UX_RING_DATA_RELAY_ID) characteristics. If you've already got a
   G2 listener, you get ring data for free.
4. **Short, dense commands.** Each frame is ~10 bytes.

## Envelope

```
[0]    0x00        frame type
[1]    0xNN        length of remaining bytes (usually 0x09)
[2]    0x61        marker / subsystem
[3]    0xNN        method (0 = get, 1 = set)
[4]    0xNN        cmd code
[5..n-2] payload
[n-1,n] 0x8a 0x03  trailer
```

No CRC. The ring doesn't care about bit errors at the application
layer — it trusts the BLE link layer.

## Commands

Decoded from the `BleRing1` enum in the Java source:

| Cmd | Name |
|-----|------|
| 0x00 | system |
| 0x01 | heartRate |
| 0x02 | spo2 |
| 0x03 | temperature |
| 0x04 | hrv |
| 0x05 | activity |
| 0x06 | sleep |
| 0x07 | sportRunCtrl |
| 0x08 | sportRunData |
| 0x09 | healthSetting |

Each command has a method (get/set) and a payload. For sensor reads
(`heartRate`, `spo2`, `temperature`, `hrv`, `activity`), the payload
is typically 2–6 bytes of little-endian uint16 values plus timestamps.

## Decoding examples

From captured relay frames:

```
000961000532103ef58a03
│ │ │ │ │ │               │
│ │ │ │ │ └── payload (0x32 0x10 0x3e 0xf5)
│ │ │ │ └──── cmd 0x00 (system)
│ │ │ └────── method 0x00 (get)
│ │ └──────── marker 0x61
│ └────────── length 0x09
└──────────── frame type 0x00
                             └── trailer 0x8a 0x03
```

A heart rate read:

```
00096100010148...8a03
  └── cmd 0x01 (heartRate), payload bytes 0x48 0x00 = 72 bpm (LE)
```

Temperature:

```
00096100010... — cmd 0x03, payload is uint16 * 0.01°C
```

See [`examples/r1-ring/r1-decode.ts`](../examples/r1-ring/r1-decode.ts)
for the full decoder.

## The relay discovery

The R1 can be driven directly (its own BLE write/notify pair), but
the interesting path is when it's already paired to G2 glasses. The
phone talks to the glasses, the glasses talk to the ring, health data
streams back through the glasses to the phone.

This was discovered purely from the G2 passive listener:
`g2-listen.ts` showed unexpected frames on `sid=0x90` that weren't
in any of our known service maps. Grepping for `0x90` in the G2
proto files found `UX_RING_ROW_DATA_ID = 144`. Bingo — the ring's
relay channel.

The relay frames on sid=0x90 contain the **same custom binary
envelope** described above, wrapped inside the G2's own protobuf
envelope. Two layers of framing: outer G2 envelope + inner R1
envelope.

This is a common pattern in companion-ecosystem devices: the
"primary" device (G2) acts as a BLE hub for accessories (R1), and
accessory protocols are tunneled over the primary's own channel.
Watch for it any time you have two devices from the same vendor
that are meant to be used together.

## Total time

- Day 1 evening: decoded the envelope and cmd enum from JADX'd
  Kotlin. 3 hours.
- Day 2: wrote `r1-decode.ts`, verified against captured relay
  frames. 1 hour.
- Day 2: discovered the relay path via G2 listener. 10 minutes.

Much faster than G2 because: non-Flutter (JADX was enough), no CRC,
no fragmentation, no protobuf, and we already had the G2 listener
infrastructure from the previous project.

## Lesson

**The second RE target in a device ecosystem is 10× faster than the
first.** Most of the G2 work was building tools (listener, snoop
parser, CRC hunter, proto extractor) and figuring out the vendor's
patterns. All of that was reusable against the R1. The actual
protocol decoding of the R1 took an afternoon.

When you pick up a new target from a vendor you've already RE'd,
expect dramatic compounding returns.
