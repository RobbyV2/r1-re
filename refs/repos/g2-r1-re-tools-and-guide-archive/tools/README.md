# tools/

Generic, reusable scripts. These take a hex log, a BLE address, or a
binary, and produce useful structure. None of them are specific to a
single device.

## TypeScript (run with `bun`)

### `ble-scan.ts`
Generic BLE scanner via `@stoprocent/noble`. Dumps every device it
sees in a 15-second window: name, UUID, RSSI, advertised services,
manufacturer data. Start here on any new BLE target.

```bash
bun tools/ble-scan.ts
```

### `parse-snoop.ts`
Parses a tab-separated hex log (from tshark or similar) into a
structured per-packet view. Assumes an EvenHub-style envelope by
default (`aa 21 ...`); adapt byte offsets for your target.

```bash
# Convert btsnoop to tab-separated hex first:
tshark -r cap.btsnoop -Y "btatt.opcode == 0x12 || btatt.opcode == 0x52" \
       -T fields -e frame.number -e frame.time_relative -e btatt.value \
       > writes.txt

# Then parse:
bun tools/parse-snoop.ts writes.txt --sid 0x06 --single-frag
```

### `crc-hunt.ts`
Brute-force the protocol's CRC. Reads a hex log, picks clean samples,
tests every common CRC-16 variant × scope × endianness combination.
See [`../guides/crc-hunting.md`](../guides/crc-hunting.md) for the
procedure and [`../guides/case-study-g2.md`](../guides/case-study-g2.md)
for a real-world walkthrough (including the fragmentation trap).

```bash
bun tools/crc-hunt.ts writes.txt --magic aa21 --non-frag --min 10
```

### `bench-bletx.ts`
Measure raw BLE `writeWithoutResponse` throughput against a target.
Runs a SERIAL round (await each write) and a QUEUED round (dispatch
all, await at end). Compares the two — if SERIAL ≫ QUEUED, you have
pacing headroom at the higher level.

```bash
bun tools/bench-bletx.ts \
    --name-re 'even G\d+' \
    --write-uuid '00002760-08c2-11e1-9073-0e8ac72e5401' \
    --size 240 --count 200
```

## Python

### `strings_to_tree.py`
Walks a `strings` dump from a Flutter/Dart `libapp.so` and builds a
navigable directory tree mirroring the Dart package layout. Not a
true decompile — Blutter does that — but instantly navigable, and
runs in two minutes instead of 20.

```bash
strings -n 4 libapp.so > strings.txt
python3 tools/strings_to_tree.py strings.txt tree_out/
# Then: tree_out/even_connect/ble/bleg2cmdservice.dart.txt etc.
```

See [`../guides/blutter-frida-tracing.md`](../guides/blutter-frida-tracing.md)
for how this fits into the broader workflow.

## Dependencies

The TS tools require:

- [Bun](https://bun.sh) — `curl -fsSL https://bun.sh/install | bash`
- `@stoprocent/noble` — `bun add @stoprocent/noble`

On macOS, Bluetooth permission has to be granted to the Bun binary.
If BLE scan returns nothing, open `System Settings → Privacy →
Bluetooth` and make sure `bun` (or `Terminal.app`) is allowed.

On Linux, you need CAP_NET_ADMIN or running as root, plus `bluez`:
`sudo setcap cap_net_raw+eip $(which node)` (or the Bun binary).
