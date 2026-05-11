# Case study: Even Realities G2 smart glasses

A full reverse engineering of a consumer BLE device's display/text/audio
protocol. Presented as a timeline of what was tried, what worked, what
didn't, and why — because the journey teaches more than the destination.

## The target

Even Realities G2 smart glasses. Two arms (L/R), each a BLE peripheral,
advertising as `even G1_<serial>_<L|R>_<suffix>`. Onboard monochrome
micro-display, speaker, microphone, 6-axis IMU. Companion app is a
Flutter app ("Mirai") that runs on iOS and Android. The glasses
normally require the companion app to display anything.

**Goal**: own the protocol. Send arbitrary text, images, and menus to
the display directly from a laptop, no companion app involved.

## Initial inventory (day 0)

- Pulled the Mirai APK, extracted `libapp.so`.
- Ran `strings_to_tree.py` while Blutter started on `libapp.so`.
- Scanned with `ble-scan.ts`, confirmed both L and R arms
  advertising, RSSI normal, two services per arm.
- Turned on Android HCI snoop, ran the companion app through
  "display navigation" and "display teleprompter" workflows,
  captured ~640 KB of btsnoop.

Immediate findings from the strings dump:

- Dart package is `package:even_connect/`, with subdirectories for
  `ble/`, `protocol/`, `services/`.
- Literal strings reference `EvenHub`, `UpdateContainer`,
  `StartUpPageContainer`, `TextContainer`, `ImageRawDataUpdate`,
  `teleprompter`, `max_map_msg`, `mini_map_msg`.
- Service IDs are defined in `service_id_def.proto` (visible as a
  string literal pointing into embedded protobuf metadata).

This told us immediately: **the protocol is protobuf-based**, the
message types are named, and the service routing is an enum.

## Envelope discovery (day 1)

Ran `parse-snoop.ts` on the btsnoop hex log. Every frame started with
`aa 21`. Sketched the header:

```
aa 21 <seq> <len> <tot> <frag> <sid> <flag> <payload...> [crc16?]
```

`seq` ranged across the full byte space, `len` matched the remaining
bytes, `tot`/`frag` incremented in groups for multi-fragment sends,
`sid` was a small integer (often `0x06`, `0x08`, `0x80`), `flag` was
almost always `0x20` for outbound.

Ran `crc-hunt.ts` against single-fragment sid=0x06 packets. Got a
**match on CCITT-FALSE, scope `[6..end-2]`, little-endian** within 25
minutes of starting. That was step 1.

## The CRC fragmentation trap (day 1, cost: ~6 hours)

Verified CCITT-FALSE against every frame: **127/127 single-fragment
packets matched, 315/315 multi-fragment packets failed.**

First wrong hypothesis: "multi-fragment packets have a per-fragment
CRC but over a different scope." Tried every scope variant on the
first fragment of a multi-frag message. No match.

Second wrong hypothesis: "multi-fragment packets skip the CRC
entirely." Partially correct — fragments 1..(n-1) have no CRC bytes.
But fragment n *does* have something at the tail that looks like a
CRC.

Right hypothesis (took too long): **CRC is computed over the
reassembled payload, not per-fragment, and appears only in the last
fragment.** Concatenate all payload bytes of all fragments, CRC the
result, compare to the last 2 bytes of fragment n.

This matched 100% of multi-fragment frames.

**Lesson**: every CRC-hunting guide now says "if per-fragment CRC
doesn't work on multi-frag messages, try reassembled CRC **before**
anything else." That lesson is in
[`crc-hunting.md`](crc-hunting.md).

## Proto extraction (day 2)

Blutter had finished by now. The output confirmed what the strings
suggested: there's a directory tree of `.proto`-equivalent message
definitions embedded in the AOT binary, recoverable by walking the
Dart type metadata.

Used a small script (part of Blutter's toolchain) to emit clean
`.proto` files. 27 total, covering:

- `common.proto` — basic types
- `service_id_def.proto` — the enum mapping `sid` bytes to services
- `EvenHub.proto` — the envelope-level outer wrapper (Cmd codes)
- `teleprompt.proto`, `navigation.proto`, `conversate.proto`,
  `dashboard.proto`, `translate.proto`, `even_ai.proto`, etc. —
  one per functional subsystem
- `dev_config_protocol.proto`, `dev_settings.proto`,
  `dev_infomation.proto`, `ota_transmit.proto` — device management
- `ring.proto` — the R1 companion ring's protocol (same family)

All 27 are included in this package under `proto/g2/`.

## Replay (day 3)

First successful replay: `g2-evenhub-replay.ts` reads `writes_0842.txt`
and writes every outgoing frame, in order, with timing. Preceded by
the single `sid=01 cmd=2` "app launch" frame that appears at the start
of every captured session.

Result: the captured navigation map rendered on the lens from a
laptop, with no companion app running. First proof that the protocol
could be driven externally.

## The pixel-byte rejection rabbit hole (day 3–5, cost: ~12 hours)

Tried to send a modified image: captured BMP with a single red 40×40
block painted over the navigation data. Result: glasses stuck on
"loading map" forever.

Tried: same BMP with all-black pixels. Same failure.
Tried: a completely synthetic 576×188 4-bpp BMP from scratch. Same
failure.
Tried: byte-for-byte replay of the captured BMP (as a sanity check).
**This worked.** So the envelope, fragmentation, CRC, and protobuf
serialization were all correct. The failure was content-specific.

This was the "pixel-byte rejection" theory: the glasses were
validating the BMP content against some invariant we hadn't found —
maybe a palette check, maybe a header-vs-data consistency check.

Decompiled the `ImageRawDataUpdate` handler in Blutter. Followed the
`LoadField`/`StoreField` trail. Found a validator that checked the
BMP header's `compressMode` field against the actual compression
applied to the data. Captured BMPs used `compressMode=1` (byte-pair
RLE, implemented as `_EvenRleCompressor::smartCompress` in the Dart
code). Our synthesized BMPs used `compressMode=0` (raw) but had
`compressMode=1` set in the field — mismatch.

Fixed the mismatch. Still stuck on "loading map."

At this point the project **pivoted**: instead of debugging the
image path, try the **text container** path. Send a `TextContainer`
via Cmd=7 UpdateContainer. If text works, we can render anything we
want via a bitmap font or a system font, and the image channel
becomes optional.

## Text works first try (day 6)

Wrote `g2-text-send.ts` in one sitting. Cmd=7 UpdateContainer with
an inner `TextContainerConfig` (x, y, width, height, flag=1, name,
flag2=0, textBytes). Sent `"hello from claude"`. **Rendered on the
lens immediately.**

Interestingly, the text path also allowed arbitrary container
creation with custom names up to 14 characters. This opened up the
ability to push multiple text layers at different positions, which
is effectively a simple windowing system.

## Image works too, eventually (day 7)

With the text path working, came back to the image path with fresh
eyes. The `compressMode` validation was one check. There was a
second: the `MapFragmentPacketSize` field had a silent cap of 4096
bytes. Captured BMPs were always ≤ 4 KB per fragment. Synthesized
ones used 8 KB per fragment for fewer fragments. Reducing to 4 KB
made image send work.

Two separate content validations, hidden behind the same "stuck on
loading map" failure mode. **Lesson**: when you hit content validation,
the failure mode is rarely "error response" — usually it's silent
hang or silent drop. Assume every "stuck" state masks ≥2 independent
validation bugs.

## Passive listener pays off (day 8)

Wrote `g2-listen.ts` to explore async events. Discovered in 30
seconds of passive listening:

1. **sid=80 heartbeats** — two kinds. Cmd=14 is a phone→glasses
   request that the glasses echo as an ack (~1/sec). Cmd=6 is a
   glasses→phone unsolicited keepalive (~1/10s) that only the R arm
   emits.
2. **sid=0d cmd=1 events** — firmware-to-app state change notifications.
   Every time a UI container is created or destroyed, this frame
   fires. Carries the sid of the affected subsystem in a nested
   protobuf field.
3. **L arm is silent for async notifications.** Only R emits sid=0e,
   sid=0d, sid=80 frames spontaneously. L only speaks when directly
   written to. This is not documented anywhere in the Dart code we
   could find — it's a property of the firmware, not the app.

Without the listener, we would never have found any of this. The
Dart code wires all the event handlers through generic `RxNotifier`
bridges, and tracing any specific event back to its BLE source
requires the runtime data.

## sid=0e: the "widget transform" misidentification (day 9)

At this point we thought sid=0e was a sensor channel (accelerometer,
head tracking). It had a high frame rate in captures and the payload
looked like floats.

Wrong. After decoding the protobuf: **sid=0e is a widget transform
channel** — Mirai uses it to reposition and scale UI elements on the
screen as the user walks (map widget pans and zooms). 53 Cmd=1
(single-widget transform) and 22 Cmd=2 (bulk transform) frames in a
10-minute nav session. Consistent with a widget repositioning
animation, not with realtime sensor data (which would be hundreds of
frames per second, not dozens).

The float values are (x, y, scale) triples plus some flags. Widget
IDs 1–9 seen. Fully decoded but not needed for any use case yet.

**Lesson**: don't trust your first guess at a channel's purpose.
Sensor data and UI animation can look identical in a capture —
similar frame sizes, similar rates. Decode before you label.

## Throughput characterization (day 10)

Built `bench-bletx.ts` to measure raw write throughput. Results:

- **Raw noble writeAsync latency**: ~0.07 ms per write in queued
  mode, ~5 ms in serial mode.
- **BLE link ceiling**: well above what we were achieving.
- **Our effective throughput**: ~8.8 KB/s max.

Conclusion: the bottleneck is **not** the BLE link. It's the
application-level ack pacing. The glasses ack each fragment before
accepting the next, and the round-trip is where the time goes. A
sliding window over multiple fragments would likely 3× throughput,
but only for image send — text fits in one frame and is already
instant.

**Lesson**: always measure the raw link before optimizing the
protocol. We almost spent a day on fragmentation window tuning
before realizing the win was elsewhere.

## Final state

Working synthesizers:

- `g2-img-send.ts` — 576×188 4-bpp BMPs over Cmd=3
  ImageRawDataUpdate, with a captured-replay mode and a synthesis
  mode that builds the protobuf from raw pixel buffers.
- `g2-text-send.ts` — arbitrary text in a named container over Cmd=7
  UpdateContainer.
- `g2-list-send.ts` — custom launcher menus over Cmd=0
  CreateStartUpPageContainer, replacing the Mirai launcher.
- `g2-listen.ts` — passive listener, both arms, all subsystems.
- `g2-transcribe.ts` — live ASR pipeline: G2 mic → LC3 decoder →
  Moonshine streaming ASR via Python sidecar.

Working end-to-end. Zero companion app involvement.

## Total time

- 0–30 min: scan, inventory, first capture
- 30 min – 2 h: envelope sketch + CRC hunt (single-fragment)
- 2 h – 8 h: CRC fragmentation trap
- day 2: proto extraction via Blutter
- day 3: replay, content validation rabbit hole begins
- day 6: text works, pivot successful
- day 7: image works
- day 8–10: passive listener + throughput + sid decoding
- day 11+: application layer (cmux frontend, transcription, custom
  menus)

Call it two weeks of evenings. Would have been one week with this
playbook in hand from day one.

## Mistakes to not repeat

1. **CRC fragmentation trap** — test per-fragment *and* reassembled
   hypotheses on your first multi-fragment sample, not after a day
   of wrong theories.
2. **Content validation failure modes are silent** — when a replay
   works but a synthesized message doesn't, assume there are ≥2
   independent validations and bisect.
3. **Don't trust the first channel guess** — sid=0e was "sensors"
   for three days before we decoded it.
4. **Listen before you speak** — we ran the passive listener on day
   8. Should have been day 1. We would have seen the async events
   immediately and saved days of static-code reading.
5. **Bench the raw link before optimizing the protocol** — we
   almost tuned fragment windows when the real bottleneck was ack
   RTT.
