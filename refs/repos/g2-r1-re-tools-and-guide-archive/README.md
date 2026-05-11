# re-care-package

A reverse engineering care package for AI coding agents (and humans) staring
at an unfamiliar BLE device, a decompiled binary, or a protocol with no spec.

Not a framework. Not a library. A collection of **guides, reusable scripts,
and annotated real-world examples** that together represent what one agent
learned the hard way over a few weeks of reversing consumer hardware from
scratch. The goal is that the next agent who gets handed a mystery `.bin`
and a capture file starts two weeks ahead of where the previous one did.

## What's in here

```
guides/        Methodology + playbooks + case studies (read these first)
tools/         Generic, reusable scripts — CRC hunter, BLE scan, snoop parser,
               strings-to-tree, throughput bench
examples/      Real working synthesizers from finished RE projects. Read them
               as illustrations of how the guides turn into code.
proto/         Clean .proto schemas extracted from a commercial device for
               reference / pattern recognition.
```

## Where to start

1. **[guides/methodology.md](guides/methodology.md)** — the core tracing
   playbook. How to go from a grep to a full call graph in decompiled code.
2. **[guides/ble-protocol-playbook.md](guides/ble-protocol-playbook.md)** —
   how to take an unknown BLE device from nothing → packets → synthesis.
3. **[guides/passive-listener-first.md](guides/passive-listener-first.md)** —
   the single biggest leverage move in BLE RE: build a listener before you
   build a sender.
4. **[guides/crc-hunting.md](guides/crc-hunting.md)** — when the protocol has
   a checksum and you don't know which one, brute-force it.
5. **[guides/blutter-frida-tracing.md](guides/blutter-frida-tracing.md)** —
   tracing calls in Blutter-decompiled Dart (Flutter AOT) binaries.
6. **[guides/case-study-g2.md](guides/case-study-g2.md)** — Even Realities G2
   smart glasses: full end-to-end RE of a BLE envelope + protobuf stack,
   including every wrong turn.
7. **[guides/case-study-r1-ring.md](guides/case-study-r1-ring.md)** — Even R1
   health ring: shorter case study of a custom-binary (not protobuf) BLE
   protocol.

## How the pieces fit together

The **guides** contain the general lessons. The **tools** are the scripts
you'll actually run on any target (they take a hex log, a BLE address, or a
binary and spit out useful structure). The **examples** are the finished
output of applying the guides with the tools against specific devices —
read them when you want to see what the final shape of a working
synthesizer looks like.

None of the examples are runnable out of the box against arbitrary
hardware — they target specific devices. They're included as reference
implementations, not as a library. Copy, adapt, rename.

## Intended audience

This package assumes you are:

- A coding agent or an experienced developer doing authorized RE work
  (pentest scope, research, interoperability, accessibility, personal
  device ownership).
- Comfortable with TypeScript (Bun), some Python, some binary analysis.
- Willing to read code slowly. Most of what's here is short and dense on
  purpose — the value is in the shape of the code, not the volume of it.

Nothing in this package is device-specific malware, credential-theft
tooling, or detection-evasion infrastructure. The case studies are all
consumer wearables the author owns.

## License

MIT. Use it, fork it, paste it into your agent prompt, whatever.
