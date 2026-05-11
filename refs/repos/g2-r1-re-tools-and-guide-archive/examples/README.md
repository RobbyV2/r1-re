# examples/

Reference implementations from real RE projects. Read them as
illustrations of how the guides turn into code — they are not a
general-purpose library and will not run against arbitrary hardware.

## g2/ — Even Realities G2 smart glasses

All scripts target two BLE peripherals advertising as
`even G1_<serial>_<L|R>_<suffix>`. They use hardcoded characteristic
UUIDs (`00002760-08c2-11e1-9073-0e8ac72e5401` for write,
`...5402` for notify). See [`../guides/case-study-g2.md`](../guides/case-study-g2.md)
for the full context.

- **`g2-listen.ts`** — passive listener, both arms, all sids. This
  is the most important one to read first. Shows the scan → connect
  → subscribe → log loop in minimal form. The only thing it sends
  is an optional single "prelude" frame (`--no-prelude` to skip).
- **`g2-img-send.ts`** — `Cmd=3 ImageRawDataUpdate` synthesizer.
  Builds a 4bpp BMP from a pixel buffer, fragments via the EvenHub
  envelope, awaits per-fragment acks. Has three pacing modes
  (`serial`, `intraBurst`, `window`) — read the arg parsing.
- **`g2-text-send.ts`** — `Cmd=7 UpdateContainer` text sender. Much
  smaller than the image sender; single-frame for text under ~220
  bytes. Good example of the minimal protobuf-building primitives
  (`pbV`, `pbB`, `pbS`).
- **`g2-list-send.ts`** — `Cmd=0 CreateStartUpPageContainer` to push
  a custom launcher menu to the glasses.

## r1-ring/ — Even R1 health ring

- **`r1-scan.ts`** — generic BLE scan narrowed to health/ring
  patterns. Useful template for narrowing a scan without knowing
  the exact advertising name.
- **`r1-connect.ts`** — connect + dump all services, characteristics,
  and descriptors on first contact with a new device. Read this
  when you need a one-shot "what does this device expose."
- **`r1-decode.ts`** — **module, not a runnable script.** Decodes
  the R1's custom-binary envelope (not protobuf). Exported function
  `decodeR1Packet(buf)` that you can import from other scripts.

## Patterns to notice

The four G2 scripts all share the same ~50-line prelude: scan for a
name pattern, wait for both peers, connect, discover, find the
write+notify characteristics, subscribe. You will write some variant
of this 10 times in a real RE project. It's worth templating once
you have 2 working examples.

The CRC function is inlined in each G2 script rather than imported
from a shared module. This is intentional — these were iterative
experiments, and the cost of a shared module (you have to find it,
read it, trust it) exceeded the cost of the duplication. Once the
protocol stabilizes, extract. Not before.

The protobuf builders (`pbVarintField`, `pbBytesField`,
`pbStringField`) are a minimal implementation of protobuf encoding
that fits on a napkin. If you want full protobuf support, use
`protobuf.js` — but for 95% of RE work, this is what you need.
